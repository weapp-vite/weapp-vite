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
import path from 'pathe'
import { createServer, transformWithOxc } from 'vite'
import { logger } from '../../context/shared'
import { parseSidecarModuleId, parseSidecarSourceRequest } from '../../moduleGraph/protocol'
import { isReactStaticTemplateSource } from '../../plugins/react'
import { parseJsLike, traverse } from '../../utils/babel'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { writeStatefulHmrOutput } from './outputWriter'
import { createStatefulHmrControlSource } from './runtimeSource'
import { createStatefulHmrSidecarPlugin } from './sidecarPlugin'
import { StatefulHmrSnapshotScheduler } from './snapshotScheduler'
import { StatefulHmrTransport } from './transport'
import { StatefulHmrViteAdapter } from './viteAdapter'

const maxRetainedDeltaCount = 1_000
const maxRetainedDeltaBytes = 16 * 1024 * 1024

export async function runStatefulHmrDev(
  ctx: MutableCompilerContext,
  buildOptions: InlineConfig,
  restart: () => Promise<void>,
  snapshots: {
    initial: StatefulHmrOutputFile[]
    rebuild: (files: string[]) => Promise<StatefulHmrOutputFile[]>
  },
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
      const currentSession = new StatefulHmrSession(ctx, server, restart, snapshots)
      session = currentSession
      currentSession.install()
    },
    transform(code, id) {
      if (
        !isStatefulHmrBoundary(
          id,
          configService.absoluteSrcRoot,
          ctx.runtimeState.build.hmr.resolvedEntryMap.keys(),
        )
        || code.includes('import.meta.hot.accept')
      ) {
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
    plugins: [createStatefulHmrSidecarPlugin(), installPlugin, ...(buildOptions.plugins ?? [])],
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
  try {
    await server.listen()
    if (!session) {
      throw new Error('微信状态保持 HMR session 未完成初始化。')
    }
    await session.refreshControl()
    return createWatcherAdapter(server, session)
  }
  catch (error) {
    await session?.close().catch(() => {})
    await server.close().catch(() => {})
    throw error
  }
}

class StatefulHmrSession {
  private activeSnapshotBatch?: { isSuperseded: () => boolean }
  private readonly adapter: StatefulHmrViteAdapter
  private readonly initialBundle = Promise.withResolvers<void>()
  private readonly snapshotScheduler: StatefulHmrSnapshotScheduler
  private readonly transport: StatefulHmrTransport
  private outputChain: Promise<void> = Promise.resolve()
  private restartTimer?: ReturnType<typeof setTimeout>
  private snapshotAssets = new Map<string, StatefulHmrOutputFile>()
  private readonly sourceChangeListener = (file: string, dirtyReasonSummary: string[]) => {
    this.handleSourceUpdate(file, dirtyReasonSummary)
  }

  constructor(
    private readonly ctx: MutableCompilerContext,
    private readonly server: ViteDevServer,
    private readonly restart: () => Promise<void>,
    private readonly snapshots: {
      initial: StatefulHmrOutputFile[]
      rebuild: (files: string[]) => Promise<StatefulHmrOutputFile[]>
    },
  ) {
    this.replaceSnapshotAssets(snapshots.initial)
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
    this.snapshotScheduler = new StatefulHmrSnapshotScheduler({
      execute: batch => this.executeSnapshotBatch(batch),
      onError: error => this.server.config.logger.error('[weapp-vite] stateful HMR snapshot refresh failed', {
        error: error instanceof Error ? error : new Error(String(error)),
      }),
    })
  }

  install(): void {
    this.transport.install()
    this.adapter.install()
    this.ctx.onStatefulHmrSourceChange = this.sourceChangeListener
  }

  async close(): Promise<void> {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
    }
    if (this.ctx.onStatefulHmrSourceChange === this.sourceChangeListener) {
      this.ctx.onStatefulHmrSourceChange = undefined
    }
    this.transport.close()
    await this.snapshotScheduler.close()
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

  handleSourceUpdate(file: string, dirtyReasonSummary: string[] = []): void {
    const normalizedFile = normalizeFsResolvedId(path.isAbsolute(file) ? file : path.resolve(this.server.config.root, file))
    const normalizedOutDir = normalizeFsResolvedId(this.ctx.configService!.outDir).replace(/\/$/, '')
    if (normalizedFile === normalizedOutDir || normalizedFile.startsWith(`${normalizedOutDir}/`)) {
      return
    }
    if (shouldRestartStatefulHmrServer(
      [normalizedFile],
      this.ctx.configService?.configFileDependencies,
      this.ctx.configService?.weappViteConfig?.react,
    )) {
      this.requestServerRestart()
      return
    }
    if (requiresStatefulHmrSnapshot(
      normalizedFile,
      dirtyReasonSummary,
    )) {
      if (!this.snapshotScheduler.isPending()) {
        logger.info('HMR 更新：正在同步模板、样式与静态资源...')
      }
      this.requestSnapshotRefresh([normalizedFile])
    }
  }

  private handleOutput(output: StatefulHmrOutputFile[]): void {
    const snapshotBatch = this.activeSnapshotBatch
    void this.enqueueOutput(async () => {
      if (snapshotBatch?.isSuperseded()) {
        return
      }
      const compatibleOutput = await transformOutput(output)
      const fullBuild = compatibleOutput.some(item => item.fileName === 'app.js')
      if (fullBuild) {
        mergeStatefulHmrSnapshotAssets(compatibleOutput, this.snapshotAssets.values())
        const buildId = this.transport.createBuildId()
        this.transport.commitFullBuild(buildId)
        stampStatefulHmrFullBuild(compatibleOutput, buildId)
        setAsset(compatibleOutput, WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, createStatefulHmrControlSource({
          ...this.transport.createControl(),
          buildId,
        }))
        setAsset(compatibleOutput, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, 'void 0;\n')
        setAsset(compatibleOutput, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE, 'void 0;\n')
      }
      await writeStatefulHmrOutput(this.ctx.configService!.outDir, compatibleOutput)
      if (fullBuild) {
        const moduleCount = await this.adapter.registerBundleModules(compatibleOutput)
        this.server.config.logger.info(`[weapp-vite] 微信状态保持 HMR 已就绪（${moduleCount} modules）`)
        this.initialBundle.resolve()
      }
    })
  }

  private handlePatch(files: string[], output: StatefulHmrDevEngineUpdate): boolean {
    if (output.type === 'Noop') {
      return false
    }
    if (!isSafeJavaScriptPatch(
      files,
      output,
      this.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary,
      this.ctx.runtimeState.build.hmr.resolvedEntryMap.keys(),
      this.server.config.root,
    )) {
      if (shouldRestartStatefulHmrServer(files, this.ctx.configService?.configFileDependencies)) {
        this.requestServerRestart()
      }
      else if (
        this.snapshotScheduler.isPending()
        || (files.length > 0 && files.every(isStatefulHmrAssetFile))
        || shouldUseStatefulHmrSnapshotOnly(this.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary ?? [])
      ) {
        if (!this.snapshotScheduler.isPending()) {
          this.requestSnapshotRefresh(files)
        }
      }
      else {
        this.requestFullBuild(files)
      }
      return false
    }
    void this.adapter.registerPatchModules(output.code).then(async () => {
      const code = await transformJavaScript(output.code, output.filename)
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
      this.transport.addDelta(code, output.changedIds ?? [])
      return this.adapter.markPayloadDelivered(output.filename)
    }).catch((error) => {
      this.server.config.logger.error('[weapp-vite] stateful HMR patch transform failed', { error })
      this.requestFullBuild()
    })
    return true
  }

  private requestFullBuild(files: Iterable<string> = []): void {
    this.snapshotScheduler.request('full', files)
  }

  private requestSnapshotRefresh(files: Iterable<string> = []): void {
    this.snapshotScheduler.request('refresh', files)
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
      this.server.config.logger.error(`[weapp-vite] stateful HMR output failed: ${formatStatefulHmrError(error)}`)
    })
    return this.outputChain
  }

  private async executeSnapshotBatch(batch: {
    files: string[]
    isSuperseded: () => boolean
    mode: 'full' | 'refresh'
  }): Promise<void> {
    const output = await this.snapshots.rebuild(batch.files)
    if (batch.isSuperseded()) {
      return
    }
    if (batch.mode === 'full') {
      this.replaceSnapshotAssets(output)
      this.activeSnapshotBatch = batch
      try {
        await this.adapter.rebuild()
        await this.outputChain
      }
      finally {
        if (this.activeSnapshotBatch === batch) {
          this.activeSnapshotBatch = undefined
        }
      }
      return
    }
    const changedOutput = getChangedStatefulHmrSnapshotAssets(this.snapshotAssets.values(), output)
    this.replaceSnapshotAssets(output)
    await this.enqueueOutput(async () => {
      if (!batch.isSuperseded()) {
        await writeStatefulHmrOutput(this.ctx.configService!.outDir, changedOutput)
      }
    })
  }

  private replaceSnapshotAssets(output: StatefulHmrOutputFile[]): void {
    this.snapshotAssets = new Map(
      output
        .filter(item => item.type === 'asset')
        .map(item => [item.fileName, item]),
    )
  }

  private async waitForInitialBundle(): Promise<void> {
    await this.initialBundle.promise
    await this.outputChain
  }
}

export function shouldRestartStatefulHmrServer(
  files: Iterable<string>,
  configFileDependencies: Iterable<string> = [],
  react?: Parameters<typeof isReactStaticTemplateSource>[0],
): boolean {
  const normalizedConfigDependencies = new Set(
    Array.from(configFileDependencies, dependency => normalizeFsResolvedId(dependency)),
  )
  return Array.from(files).some(file =>
    normalizedConfigDependencies.has(normalizeFsResolvedId(file))
    || isReactStaticTemplateSource(react, file),
  )
}

export function mergeStatefulHmrSnapshotAssets(
  output: StatefulHmrOutputFile[],
  snapshotAssets: Iterable<StatefulHmrOutputFile>,
): void {
  for (const asset of snapshotAssets) {
    if (asset.type !== 'asset') {
      continue
    }
    const index = output.findIndex(item => item.fileName === asset.fileName)
    if (index >= 0) {
      output[index] = asset
    }
    else {
      output.push(asset)
    }
  }
}

export function getChangedStatefulHmrSnapshotAssets(
  previous: Iterable<StatefulHmrOutputFile>,
  next: Iterable<StatefulHmrOutputFile>,
): StatefulHmrOutputFile[] {
  const previousAssets = new Map(
    Array.from(previous).flatMap(item => item.type === 'asset' ? [[item.fileName, item.source] as const] : []),
  )
  return Array.from(next).filter((item) => {
    if (item.type !== 'asset') {
      return true
    }
    const previousSource = previousAssets.get(item.fileName)
    return previousSource === undefined || !statefulHmrAssetSourcesEqual(previousSource, item.source)
  })
}

type StatefulHmrAssetSource = Extract<StatefulHmrOutputFile, { type: 'asset' }>['source']

function statefulHmrAssetSourcesEqual(left: StatefulHmrAssetSource, right: StatefulHmrAssetSource): boolean {
  if (left === right) {
    return true
  }
  const leftBuffer = Buffer.isBuffer(left) ? left : Buffer.from(left)
  const rightBuffer = Buffer.isBuffer(right) ? right : Buffer.from(right)
  return leftBuffer.equals(rightBuffer)
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

export function isStatefulHmrBoundary(id: string, srcRoot: string, entryIds?: Iterable<string>): boolean {
  const sidecar = parseSidecarSourceRequest(id)
  const sourceId = sidecar?.kind === 'script' ? sidecar.sourceId : id.includes('?') ? undefined : id
  if (!sourceId) {
    return false
  }
  const normalizedSourceId = normalizeFsResolvedId(sourceId)
  const normalizedSrcRoot = normalizeFsResolvedId(srcRoot).replace(/\/$/, '')
  if (
    !normalizedSourceId.startsWith(`${normalizedSrcRoot}/`)
    || !/\.(?:[cm]?[jt]sx?|vue)$/.test(normalizedSourceId)
  ) {
    return false
  }
  if (!entryIds) {
    return true
  }
  for (const entryId of entryIds) {
    if (normalizeFsResolvedId(entryId) === normalizedSourceId) {
      return true
    }
  }
  return false
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
  entryIds?: Iterable<string>,
  root?: string,
): output is Extract<StatefulHmrDevEngineUpdate, { type: 'Patch' }> {
  const normalizedEntryIds = entryIds
    ? new Set(Array.from(entryIds, entryId => normalizeFsResolvedId(entryId)))
    : undefined
  return output.type === 'Patch'
    && files.every(file => /\.(?:[cm]?[jt]sx?|vue)$/.test(file))
    && (!normalizedEntryIds || files.every((file) => {
      const absoluteFile = path.isAbsolute(file) || !root ? file : path.resolve(root, file)
      return normalizedEntryIds.has(normalizeFsResolvedId(absoluteFile))
    }))
    && !output.changedIds?.some(isNonJavaScriptSidecarId)
    && !dirtyReasonSummary.some(isUnsafeStatefulHmrReason)
}

export function requiresStatefulHmrSnapshot(file: string, dirtyReasonSummary: string[] = []): boolean {
  return /\.(?:jsx|tsx)$/.test(file)
    || !/\.(?:[cm]?[jt]sx?|vue)$/.test(file)
    || dirtyReasonSummary.some(isUnsafeStatefulHmrReason)
}

export function isStatefulHmrAssetFile(file: string): boolean {
  return !/\.(?:[cm]?[jt]sx?|vue)$/.test(file)
}

function isUnsafeStatefulHmrReason(reason: string): boolean {
  return /^(?:entry-json-only|entry-local-asset|entry-style-only|react-template|tailwind-content):/.test(reason)
}

export function shouldUseStatefulHmrSnapshotOnly(dirtyReasonSummary: string[]): boolean {
  const hasAssetOnlyEntry = dirtyReasonSummary.some(reason =>
    /^(?:entry-json-only|entry-local-asset|entry-style-only):/.test(reason),
  )
  return hasAssetOnlyEntry && dirtyReasonSummary.every(reason =>
    /^(?:entry-json-only|entry-local-asset|entry-style-only|tailwind-content):/.test(reason),
  )
}

function isNonJavaScriptSidecarId(id: string): boolean {
  const sidecar = parseSidecarSourceRequest(id) ?? parseSidecarModuleId(id)
  return sidecar !== undefined && sidecar.kind !== 'script'
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

export function stampStatefulHmrFullBuild(output: StatefulHmrOutputFile[], buildId: string): void {
  for (const item of output) {
    if (item.type === 'chunk' && item.fileName.endsWith('.js')) {
      item.code = `// weapp-vite-stateful-build:${buildId}\n${item.code}`
    }
  }
}

function formatStatefulHmrError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message
  }
  return String(error)
}
