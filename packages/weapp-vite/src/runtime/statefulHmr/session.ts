/* eslint-disable ts/no-use-before-define */

import type { RolldownWatcher } from 'rolldown'
import type { InlineConfig, Plugin, ViteDevServer } from 'vite'
import type { MutableCompilerContext } from '../../context'
import type { StatefulHmrOutputFile } from './outputWriter'
import type { StatefulHmrDevEngineUpdate } from './viteAdapter'
import { Buffer } from 'node:buffer'
import {
  WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY,
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
} from '@weapp-core/constants'
import MagicString from 'magic-string'
import { createServer, transformWithOxc } from 'vite'
import { parseSidecarSourceRequest } from '../../moduleGraph/protocol'
import { parseJsLike, traverse } from '../../utils/babel'
import { writeStatefulHmrOutput } from './outputWriter'
import { createStatefulHmrControlSource } from './runtimeSource'
import { StatefulHmrTransport } from './transport'
import { StatefulHmrViteAdapter } from './viteAdapter'

const maxRetainedDeltaCount = 1_000
const maxRetainedDeltaBytes = 16 * 1024 * 1024

export async function runStatefulHmrDev(
  ctx: MutableCompilerContext,
  buildOptions: InlineConfig,
  restart: () => Promise<void>,
): Promise<RolldownWatcher> {
  const configService = ctx.configService!
  if (configService.platform !== 'weapp') {
    throw new Error('weapp.hmr.runtime="stateful-experimental" 目前仅支持微信小程序平台。')
  }
  let session: StatefulHmrSession | undefined
  const installPlugin: Plugin = {
    name: 'weapp-vite:stateful-hmr-session',
    enforce: 'post',
    configureServer(server) {
      const currentSession = new StatefulHmrSession(ctx, server, restart)
      session = currentSession
      currentSession.install()
    },
    transform(code, id) {
      if (!isStatefulHmrBoundary(id, configService.absoluteSrcRoot) || code.includes('import.meta.hot.accept')) {
        return
      }
      const transformed = id.endsWith('.vue') ? code : redirectNativeComponentRegistration(code)
      return `${transformed}\nif (import.meta.hot) import.meta.hot.accept();\n`
    },
  }
  const server = await createServer({
    ...buildOptions,
    appType: 'custom',
    configFile: false,
    define: {
      ...(buildOptions.define ?? {}),
      App: `globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)}].App`,
      Page: `globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)}].Page`,
    },
    experimental: {
      ...(buildOptions.experimental ?? {}),
      bundledDev: true,
    },
    plugins: [installPlugin, ...(buildOptions.plugins ?? [])],
    server: {
      ...(buildOptions.server ?? {}),
      host: '127.0.0.1',
      port: 0,
    },
    build: {
      ...(buildOptions.build ?? {}),
      watch: undefined,
      write: false,
    },
  })
  await server.listen()
  if (!session) {
    await server.close()
    throw new Error('微信状态保持 HMR session 未完成初始化。')
  }
  await session.refreshControl()
  return createWatcherAdapter(server, session)
}

class StatefulHmrSession {
  private readonly adapter: StatefulHmrViteAdapter
  private readonly initialBundle = Promise.withResolvers<void>()
  private readonly transport: StatefulHmrTransport
  private outputChain: Promise<void> = Promise.resolve()
  private rebuildTimer?: ReturnType<typeof setTimeout>
  private restartTimer?: ReturnType<typeof setTimeout>

  constructor(
    private readonly ctx: MutableCompilerContext,
    private readonly server: ViteDevServer,
    private readonly restart: () => Promise<void>,
  ) {
    this.transport = new StatefulHmrTransport(
      server,
      async (buildId, source) => {
        await this.enqueueOutput(async () => {
          if (!this.transport.isCurrentBuild(buildId)) {
            return
          }
          await writeStatefulHmrOutput(this.ctx.configService!.outDir, [{
            type: 'asset',
            fileName: WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
            source,
          }])
        })
      },
      () => this.requestFullBuild(),
    )
    this.adapter = new StatefulHmrViteAdapter(server.config, server, {
      onError: message => server.config.logger.error(`[weapp-vite] stateful HMR: ${message}`),
      onOutput: output => this.handleOutput(output),
      onPatch: (files, output) => this.handlePatch(files, output),
      waitForInitialBundle: () => this.waitForInitialBundle(),
    })
  }

  install(): void {
    this.transport.install()
    this.adapter.install()
  }

  async close(): Promise<void> {
    if (this.rebuildTimer) {
      clearTimeout(this.rebuildTimer)
    }
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
    }
    this.transport.close()
    await this.outputChain
  }

  async refreshControl(): Promise<void> {
    await this.enqueueOutput(async () => {
      await writeStatefulHmrOutput(this.ctx.configService!.outDir, [{
        type: 'asset',
        fileName: WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
        source: createStatefulHmrControlSource(this.transport.createControl()),
      }])
    })
  }

  private handleOutput(output: StatefulHmrOutputFile[]): void {
    void this.enqueueOutput(async () => {
      const compatibleOutput = await transformOutput(output)
      const fullBuild = compatibleOutput.some(item => item.fileName === 'app.js')
      if (fullBuild) {
        const buildId = this.transport.createBuildId()
        this.transport.commitFullBuild(buildId)
        setAsset(compatibleOutput, WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, createStatefulHmrControlSource({
          ...this.transport.createControl(),
          buildId,
        }))
        setAsset(compatibleOutput, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, 'void 0;\n')
        setAsset(compatibleOutput, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE, 'void 0;\n')
      }
      await writeStatefulHmrOutput(this.ctx.configService!.outDir, compatibleOutput)
      if (fullBuild) {
        const moduleCount = this.adapter.registerBundleModules(compatibleOutput)
        this.server.config.logger.info(`[weapp-vite] 微信状态保持 HMR 已就绪（${moduleCount} modules）`)
        this.initialBundle.resolve()
      }
    })
  }

  private handlePatch(files: string[], output: StatefulHmrDevEngineUpdate): boolean {
    if (!isSafeJavaScriptPatch(files, output, this.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary)) {
      this.requestServerRestart()
      return false
    }
    this.adapter.registerPatchModules(output.code)
    void transformJavaScript(output.code, output.filename).then((code) => {
      if (
        shouldResetStatefulHmrRetention(
          this.transport.retainedDeltaCount,
          this.transport.retainedDeltaBytes,
          Buffer.byteLength(code),
        )
      ) {
        this.requestFullBuild()
        return
      }
      this.transport.addDelta(code)
    }).catch((error) => {
      this.server.config.logger.error('[weapp-vite] stateful HMR patch transform failed', { error })
      this.requestFullBuild()
    })
    return true
  }

  private requestFullBuild(): void {
    if (this.rebuildTimer) {
      return
    }
    this.rebuildTimer = setTimeout(() => {
      this.rebuildTimer = undefined
      void this.adapter.rebuild().catch((error) => {
        this.server.config.logger.error('[weapp-vite] stateful HMR full rebuild failed', { error })
      })
    }, 100)
  }

  private requestServerRestart(): void {
    if (this.restartTimer) {
      return
    }
    this.restartTimer = setTimeout(() => {
      this.restartTimer = undefined
      void this.restart().catch((error) => {
        this.server.config.logger.error('[weapp-vite] stateful HMR server restart failed', { error })
      })
    }, 100)
  }

  private enqueueOutput(task: () => Promise<void>): Promise<void> {
    this.outputChain = this.outputChain.then(task, task).catch((error) => {
      this.server.config.logger.error('[weapp-vite] stateful HMR output failed', { error })
    })
    return this.outputChain
  }

  private async waitForInitialBundle(): Promise<void> {
    await this.initialBundle.promise
    await this.outputChain
  }
}

function createWatcherAdapter(server: ViteDevServer, session: StatefulHmrSession): RolldownWatcher {
  return {
    close: async () => {
      await session.close()
      await server.close()
    },
    on() {
      return this
    },
  } as unknown as RolldownWatcher
}

export function isStatefulHmrBoundary(id: string, srcRoot: string): boolean {
  const sidecar = parseSidecarSourceRequest(id)
  const sourceId = sidecar?.kind === 'script' ? sidecar.sourceId : id.includes('?') ? undefined : id
  if (!sourceId) {
    return false
  }
  const normalizedSourceId = sourceId.replaceAll('\\', '/')
  const normalizedSrcRoot = srcRoot.replaceAll('\\', '/').replace(/\/$/, '')
  return normalizedSourceId.startsWith(`${normalizedSrcRoot}/`)
    && /\.(?:[cm]?[jt]sx?|vue)$/.test(normalizedSourceId)
}

export function redirectNativeComponentRegistration(code: string): string {
  if (!code.includes('Component')) {
    return code
  }
  const ast = parseJsLike(code)
  const magicString = new MagicString(code)
  let changed = false
  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee
      if (
        callee.type !== 'Identifier'
        || callee.name !== 'Component'
        || path.scope.hasBinding('Component')
        || callee.start == null
        || callee.end == null
      ) {
        return
      }
      magicString.overwrite(
        callee.start,
        callee.end,
        `globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)}].Component`,
      )
      changed = true
    },
  })
  return changed ? magicString.toString() : code
}

export function isSafeJavaScriptPatch(
  files: string[],
  output: StatefulHmrDevEngineUpdate,
  dirtyReasonSummary: string[] = [],
): output is Extract<StatefulHmrDevEngineUpdate, { type: 'Patch' }> {
  return output.type === 'Patch'
    && output.hmrBoundaries.length > 0
    && files.every(file => /\.(?:[cm]?[jt]sx?|vue)$/.test(file))
    && !dirtyReasonSummary.some(reason => /^(?:entry-json-only|entry-local-asset|entry-style-only):/.test(reason))
}

export function shouldResetStatefulHmrRetention(
  retainedDeltaCount: number,
  retainedDeltaBytes: number,
  nextDeltaBytes: number,
): boolean {
  return retainedDeltaCount >= maxRetainedDeltaCount
    || retainedDeltaBytes + nextDeltaBytes >= maxRetainedDeltaBytes
}

async function transformOutput(output: StatefulHmrOutputFile[]): Promise<StatefulHmrOutputFile[]> {
  return await Promise.all(output.map(async (item) => {
    if (item.type !== 'chunk') {
      return item
    }
    return {
      ...item,
      code: await transformJavaScript(item.code, item.fileName),
    }
  }))
}

async function transformJavaScript(code: string, filename: string): Promise<string> {
  const result = await transformWithOxc(code, filename, {
    assumptions: { setPublicClassFields: true },
    lang: 'js',
    sourcemap: false,
    target: 'es2018',
  })
  return result.code
}

function setAsset(output: StatefulHmrOutputFile[], fileName: string, source: string): void {
  const index = output.findIndex(item => item.fileName === fileName)
  const asset: StatefulHmrOutputFile = { type: 'asset', fileName, source }
  if (index >= 0) {
    output[index] = asset
  }
  else {
    output.push(asset)
  }
}
