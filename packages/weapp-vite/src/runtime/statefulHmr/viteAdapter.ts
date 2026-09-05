/* eslint-disable ts/no-use-before-define */

import type { DevEngine, DevOptions } from 'rolldown/experimental'
import type { ResolvedConfig, ViteDevServer } from 'vite'
import type { StatefulHmrOutputFile } from './outputWriter'
import { createRequire } from 'node:module'
import path from 'node:path'
import {
  WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY,
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
} from '@weapp-core/constants'
import { dev } from 'rolldown/experimental'
import { assertStatefulHmrRuntimeOutput, createStatefulHmrRolldownRuntimeSource } from './commonRuntime'

const clientId = 'weapp-vite-stateful-hmr'
const initialBuildTimeoutMs = 60_000
const require = createRequire(import.meta.url)

function resolveViteDevEngine(): typeof dev {
  try {
    const vitePackagePath = require.resolve('vite/package.json')
    const viteRequire = createRequire(vitePackagePath)
    const viteRolldown = viteRequire('rolldown/experimental') as { dev?: typeof dev }
    if (typeof viteRolldown.dev === 'function') {
      return viteRolldown.dev
    }
  }
  catch {
    // Vite 未暴露 Rolldown 时回退到 weapp-vite 自身依赖。
  }
  return dev
}

async function withInitialBuildTimeout<T>(task: Promise<T>, timeoutMs = initialBuildTimeoutMs): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      task,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`stateful-experimental HMR 初始构建超时（>${timeoutMs}ms）。`))
        }, timeoutMs)
      }),
    ])
  }
  finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

export type StatefulHmrDevEngineUpdate
  = | { type: 'Noop' }
    | { type: 'FullReload', reason?: string }
    | {
      type: 'Patch'
      changedIds?: string[]
      code: string
      filename: string
      hmrBoundaries?: Array<{ acceptedVia: string, boundary: string }>
      seq?: number
      sourcemap?: string
      sourcemapFilename?: string
    }

type StatefulHmrDevEngine = DevEngine & {
  registerModules?: (clientId: string, modules: string[]) => Promise<void> | void
}

type StatefulHmrDevWatchOptions = Pick<
  NonNullable<DevOptions['watch']>,
  'compareContentsForPolling' | 'pollInterval' | 'usePolling'
>

function collectRolldownAliasEntries(config: ResolvedConfig) {
  const aliases = Array.isArray(config.resolve?.alias) ? config.resolve.alias : []
  const entries: Record<string, string> = {}
  for (const alias of aliases) {
    if (typeof alias.find === 'string' && typeof alias.replacement === 'string') {
      entries[alias.find] = alias.replacement
    }
  }
  return entries
}

interface BundledDevInternal {
  _devEngine?: StatefulHmrDevEngine
  getRolldownOptions: () => Promise<Record<string, any>>
  listen: () => Promise<void>
  storeOutputFiles: (output: StatefulHmrOutputFile[]) => void
}

export class StatefulHmrViteAdapter {
  private bundledDev?: BundledDevInternal
  private initialOutputError?: Error
  private initialRuntimeValidated = false

  constructor(
    private readonly config: ResolvedConfig,
    private readonly server: ViteDevServer,
    private readonly callbacks: {
      onError: (message: string) => void
      onOutput: (output: StatefulHmrOutputFile[]) => void
      onPatch: (files: string[], output: StatefulHmrDevEngineUpdate) => boolean
      waitForInitialBundle: () => Promise<void>
    },
    private readonly watchOptions: StatefulHmrDevWatchOptions = {},
    private readonly createDevEngine: typeof dev = resolveViteDevEngine(),
    private readonly initialBuildTimeout = initialBuildTimeoutMs,
  ) {}

  install(): void {
    const bundledDev = this.server.environments.client.bundledDev as unknown as BundledDevInternal | undefined
    if (!bundledDev) {
      throw new Error('stateful-experimental HMR 需要 Vite experimental.bundledDev。')
    }
    if (typeof bundledDev.getRolldownOptions !== 'function' || typeof bundledDev.storeOutputFiles !== 'function') {
      throw new TypeError('当前 Vite bundled-development 私有 API 与 weapp-vite 不兼容。')
    }
    this.bundledDev = bundledDev
    this.installOptions(bundledDev)
    this.installOutput(bundledDev)
    this.installListener(bundledDev)
  }

  async rebuild(prepare?: () => Promise<void>): Promise<void> {
    const engine = this.bundledDev?._devEngine
    if (!engine) {
      throw new Error('Vite DevEngine 未初始化，无法执行 stateful HMR 完整刷新。')
    }
    await prepare?.()
    engine.triggerFullBuild()
    await engine.ensureLatestBuildOutput()
  }

  async registerBundleModules(output: StatefulHmrOutputFile[]): Promise<number> {
    const moduleIds = new Set<string>()
    const payloadFilenames: string[] = []
    for (const item of output) {
      if (item.type !== 'chunk') {
        continue
      }
      payloadFilenames.push(item.fileName)
      for (const match of item.code.matchAll(/registerModule\("([^"]+)"/g)) {
        moduleIds.add(match[1]!)
      }
      for (const id of Object.keys(item.modules ?? {})) {
        const normalized = toStableModuleId(id, this.config.root)
        if (!moduleIds.has(normalized)) {
          moduleIds.add(normalized)
        }
      }
    }
    await this.registerModules([...moduleIds])
    await this.markPayloadsDelivered(payloadFilenames)
    return moduleIds.size
  }

  async registerPatchModules(code: string): Promise<void> {
    const moduleIds = new Set<string>()
    for (const match of code.matchAll(/create(?:Esm|Cjs)Initializer\("([^"]+)"/g)) {
      moduleIds.add(match[1]!)
    }
    await this.registerModules([...moduleIds])
  }

  async markPayloadDelivered(filename: string): Promise<void> {
    await this.markPayloadsDelivered([filename])
  }

  private async registerModules(moduleIds: string[]): Promise<void> {
    const engine = this.bundledDev?._devEngine
    if (moduleIds.length && typeof engine?.registerModules === 'function') {
      await engine.registerModules(clientId, moduleIds)
    }
  }

  private async markPayloadsDelivered(filenames: string[]): Promise<void> {
    const engine = this.bundledDev?._devEngine
    if (typeof engine?.notifyPayloadDelivered !== 'function') {
      return
    }
    for (const filename of filenames) {
      await engine.notifyPayloadDelivered(filename)
    }
  }

  private installOptions(bundledDev: BundledDevInternal): void {
    const original = bundledDev.getRolldownOptions.bind(bundledDev)
    bundledDev.getRolldownOptions = async () => {
      const options = await original()
      const output = Array.isArray(options.output)
        ? (options.output[0] ??= {})
        : (options.output ??= {})
      const aliases = collectRolldownAliasEntries(this.config)
      if (Object.keys(aliases).length > 0) {
        options.resolve = {
          ...(options.resolve ?? {}),
          alias: {
            ...(options.resolve?.alias ?? {}),
            ...aliases,
          },
        }
      }
      const configuredOutput = this.config.build.rolldownOptions.output
      const desiredOutput = Array.isArray(configuredOutput) ? configuredOutput[0] : configuredOutput
      Object.assign(output, desiredOutput)
      const userBanner = output.banner
      const userFooter = output.footer
      output.format = 'cjs'
      output.minify = false
      output.sourcemap = false
      output.banner = async (chunk: { fileName: string, isEntry?: boolean }) => {
        const existing = typeof userBanner === 'function' ? await userBanner(chunk) : (userBanner ?? '')
        return `${existing}${existing ? '\n' : ''}${createStatefulHmrBanner(chunk)}`
      }
      output.footer = async (chunk: { fileName: string, isEntry?: boolean }) => {
        const statefulFooter = createStatefulHmrFooter(chunk)
        const existing = typeof userFooter === 'function' ? await userFooter(chunk) : (userFooter ?? '')
        return `${statefulFooter}${statefulFooter && existing ? '\n' : ''}${existing}`
      }
      options.experimental ??= {}
      options.experimental.devMode = {
        ...(typeof options.experimental.devMode === 'object' ? options.experimental.devMode : {}),
        implement: createStatefulHmrRolldownRuntimeSource(),
        lazy: false,
        skipCommonRuntimeInjection: true,
      }
      return options
    }
  }

  private installOutput(bundledDev: BundledDevInternal): void {
    const original = bundledDev.storeOutputFiles.bind(bundledDev)
    bundledDev.storeOutputFiles = (output) => {
      try {
        if (!this.initialRuntimeValidated && output.some(item => item.fileName === 'app.js')) {
          assertStatefulHmrRuntimeOutput(output)
          this.initialRuntimeValidated = true
        }
        original(output)
        this.callbacks.onOutput(output)
      }
      catch (error) {
        this.initialOutputError = error instanceof Error ? error : new Error(String(error))
        throw error
      }
    }
  }

  private installListener(bundledDev: BundledDevInternal): void {
    bundledDev.listen = async () => {
      const rolldownOptions = await bundledDev.getRolldownOptions()
      if (Array.isArray(rolldownOptions.output) && rolldownOptions.output.length > 1) {
        throw new Error('stateful-experimental HMR 不支持多组 Rolldown output 配置。')
      }
      const outputOptions = Array.isArray(rolldownOptions.output)
        ? rolldownOptions.output[0]
        : rolldownOptions.output
      const engine = await this.createDevEngine(rolldownOptions, outputOptions, {
        onAdditionalAssets: result => bundledDev.storeOutputFiles(result.output as StatefulHmrOutputFile[]),
        onHmrUpdates: result => this.handleHmrUpdates(result),
        onOutput: (result) => {
          if (result instanceof Error) {
            this.initialOutputError = result
            this.callbacks.onError(result.message)
            return
          }
          bundledDev.storeOutputFiles(result.output as StatefulHmrOutputFile[])
        },
        watch: {
          skipWrite: true,
          ...this.watchOptions,
        },
      }) as StatefulHmrDevEngine
      bundledDev._devEngine = engine
      void engine.run().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        this.callbacks.onError(message)
      })
      await engine.registerClient(clientId)
      await withInitialBuildTimeout(engine.ensureCurrentBuildFinish(), this.initialBuildTimeout)
      if (this.initialOutputError) {
        throw this.initialOutputError
      }
      if ((await engine.getBundleState()).lastBuildErrored) {
        throw new Error('微信状态保持 HMR 初次构建失败。')
      }
      await withInitialBuildTimeout(this.callbacks.waitForInitialBundle(), this.initialBuildTimeout)
    }
  }

  private handleHmrUpdates(result: Parameters<NonNullable<DevOptions['onHmrUpdates']>>[0]): void {
    if (result instanceof Error) {
      this.callbacks.onError(result.message)
      return
    }
    if (result.changedFiles.length === 0) {
      return
    }
    for (const { clientId: updateClientId, update } of result.updates) {
      if (updateClientId === clientId) {
        this.callbacks.onPatch(result.changedFiles, update as StatefulHmrDevEngineUpdate)
      }
    }
  }
}

export function createStatefulHmrBanner(chunk: { fileName: string, isEntry?: boolean }): string {
  if (chunk.fileName === 'app.js') {
    return [
      `require(${JSON.stringify(`./${WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE}`)});`,
      'require("./rolldown-runtime.js");',
      `globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)}].installNative('App', definition => App(definition));`,
    ].join('')
  }
  if (!chunk.isEntry || !chunk.fileName.endsWith('.js')) {
    return ''
  }
  const prefix = '../'.repeat(chunk.fileName.split('/').length - 1)
  return [
    `require(${JSON.stringify(`${prefix}rolldown-runtime.js`)});`,
    `globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)}].installNative('Page', definition => Page(definition));`,
    `globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)}].installNative('Component', definition => Component(definition));`,
    `require(${JSON.stringify(`${prefix}${WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE}`)});`,
    `require(${JSON.stringify(`${prefix}${WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE}`)});`,
  ].join('')
}

export function createStatefulHmrFooter(chunk: { fileName: string, isEntry?: boolean }): string {
  if (!chunk.isEntry || chunk.fileName === 'app.js' || !chunk.fileName.endsWith('.js')) {
    return ''
  }
  return `for (const definition of globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)}].takeNativeDefinitions('Component')) Component(definition);`
}

export function toStableModuleId(id: string, root: string): string {
  const normalizedId = id.replaceAll('\\', '/')
  const absolute = path.posix.isAbsolute(normalizedId) || /^[A-Z]:\//i.test(normalizedId)
  if (normalizedId.startsWith('\0') || !absolute) {
    return normalizedId
  }
  return path.posix.relative(root.replaceAll('\\', '/'), normalizedId)
}
