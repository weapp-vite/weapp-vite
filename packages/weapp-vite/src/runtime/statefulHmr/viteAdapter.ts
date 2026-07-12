/* eslint-disable ts/no-use-before-define */

import type { ResolvedConfig, ViteDevServer } from 'vite'
import type { StatefulHmrOutputFile } from './outputWriter'
import path from 'node:path'
import {
  WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY,
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
} from '@weapp-core/constants'
import { statefulHmrRolldownRuntimeSource } from './runtimeSource'

const clientId = 'weapp-vite-stateful-hmr'

export type StatefulHmrDevEngineUpdate
  = | { type: 'Noop' }
    | { type: 'FullReload', reason?: string }
    | { type: 'Patch', code: string, filename: string, hmrBoundaries: Array<{ acceptedVia: string, boundary: string }> }

interface BundledDevInternal {
  _devEngine?: {
    ensureCurrentBuildFinish: () => Promise<void>
    ensureLatestBuildOutput: () => Promise<unknown>
    getBundleState: () => Promise<{ lastBuildErrored: boolean }>
    registerModules: (clientId: string, modules: string[]) => void
    triggerFullBuild: () => void
  }
  clients: {
    setupIfNeeded: (client: { send: (payload: unknown) => void }, clientId: string) => void
  }
  getRolldownOptions: () => Promise<Record<string, any>>
  handleHmrOutput: (
    client: { send: (payload: unknown) => void },
    files: string[],
    output: StatefulHmrDevEngineUpdate,
    info?: unknown,
  ) => void
  listen: () => Promise<void>
  storeOutputFiles: (output: StatefulHmrOutputFile[]) => void
}

export class StatefulHmrViteAdapter {
  private bundledDev?: BundledDevInternal

  constructor(
    private readonly config: ResolvedConfig,
    private readonly server: ViteDevServer,
    private readonly callbacks: {
      onError: (message: string) => void
      onOutput: (output: StatefulHmrOutputFile[]) => void
      onPatch: (files: string[], output: StatefulHmrDevEngineUpdate) => boolean
      waitForInitialBundle: () => Promise<void>
    },
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
    this.installPatches(bundledDev)
    this.installListener(bundledDev)
  }

  async rebuild(): Promise<void> {
    const engine = this.bundledDev?._devEngine
    if (!engine) {
      return
    }
    engine.triggerFullBuild()
    await engine.ensureLatestBuildOutput()
  }

  registerBundleModules(output: StatefulHmrOutputFile[]): number {
    const moduleIds = new Set<string>()
    for (const item of output) {
      if (item.type !== 'chunk') {
        continue
      }
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
    this.registerModules([...moduleIds])
    return moduleIds.size
  }

  registerPatchModules(code: string): void {
    const moduleIds = new Set<string>()
    for (const match of code.matchAll(/create(?:Esm|Cjs)Initializer\("([^"]+)"/g)) {
      moduleIds.add(match[1]!)
    }
    this.registerModules([...moduleIds])
  }

  private registerModules(moduleIds: string[]): void {
    if (moduleIds.length) {
      this.bundledDev?._devEngine?.registerModules(clientId, moduleIds)
    }
  }

  private installOptions(bundledDev: BundledDevInternal): void {
    const original = bundledDev.getRolldownOptions.bind(bundledDev)
    bundledDev.getRolldownOptions = async () => {
      const options = await original()
      const output = Array.isArray(options.output)
        ? (options.output[0] ??= {})
        : (options.output ??= {})
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
        implement: statefulHmrRolldownRuntimeSource,
        lazy: false,
      }
      return options
    }
  }

  private installOutput(bundledDev: BundledDevInternal): void {
    const original = bundledDev.storeOutputFiles.bind(bundledDev)
    bundledDev.storeOutputFiles = (output) => {
      original(output)
      this.callbacks.onOutput(output)
    }
  }

  private installPatches(bundledDev: BundledDevInternal): void {
    const original = bundledDev.handleHmrOutput.bind(bundledDev)
    bundledDev.handleHmrOutput = (client, files, output, info) => {
      if (output.type === 'Noop') {
        return
      }
      if (this.callbacks.onPatch(files, output)) {
        original(client, files, output, info)
      }
    }
  }

  private installListener(bundledDev: BundledDevInternal): void {
    const original = bundledDev.listen.bind(bundledDev)
    bundledDev.listen = async () => {
      await original()
      bundledDev.clients.setupIfNeeded({ send: payload => this.handlePayload(payload) }, clientId)
      const engine = bundledDev._devEngine
      if (!engine) {
        throw new Error('Vite 未初始化微信状态保持 HMR 所需的 DevEngine。')
      }
      await engine.ensureCurrentBuildFinish()
      if ((await engine.getBundleState()).lastBuildErrored) {
        throw new Error('微信状态保持 HMR 初次构建失败。')
      }
      await this.callbacks.waitForInitialBundle()
    }
  }

  private handlePayload(payload: unknown): void {
    if (!payload || typeof payload !== 'object') {
      return
    }
    const candidate = payload as { err?: { message?: unknown }, type?: unknown }
    if (candidate.type === 'error' && typeof candidate.err?.message === 'string') {
      this.callbacks.onError(candidate.err.message)
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
