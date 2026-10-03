import type { DevEngine } from 'rolldown/experimental'
import type { ViteDevServer } from 'vite'
import type { EditAction, SequenceInput } from './driver'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'
import { weapp } from 'weapp-vite/vite'
import { compareBenchmarkOutputs, snapshotBenchmarkOutputs } from '../benchmarkTemplatesHmr/outputScope'
import { applyAction, bounded } from './driver'
import { FrameworkSequenceRuntime } from './frameworkRuntime'
import { SequenceMeasurements } from './measurement'
import { observeSettledSequencePublication } from './publicationBarrier'
import { observePublishedFiles } from './published'
import { SequenceResourceOwnership } from './resourceOwnership'

/** 完整 weapp/Vue/Wevu 插件宿主；仅 fixture 输入手工写入，产物全部由原生构建链发布。 */
export class FrameworkSequenceSession {
  private server?: ViteDevServer
  private files: Readonly<Record<string, string>> = {}
  private readonly outDir: string
  private readonly runtime: FrameworkSequenceRuntime
  private readonly stateful: boolean
  private readonly watchers = new SequenceResourceOwnership()
  private readonly engines = new SequenceResourceOwnership()
  readonly measurements: SequenceMeasurements
  outputChanges?: ReturnType<typeof compareBenchmarkOutputs>

  constructor(mode: 'weapp-classic' | 'weapp-stateful', private readonly root: string) {
    this.stateful = mode === 'weapp-stateful'
    this.outDir = path.join(root, 'dist')
    this.runtime = new FrameworkSequenceRuntime(root, this.outDir, this.stateful)
    this.measurements = new SequenceMeasurements(root)
  }

  private get engine() {
    return (this.server?.environments.client?.bundledDev as { _devEngine?: DevEngine } | undefined)?._devEngine
  }

  async observe(input: SequenceInput) {
    this.measurements.reset()
    const before = this.server ? await snapshotBenchmarkOutputs(this.outDir) : {}
    const first = !this.server
    await this.writeSources(input)
    if (first) {
      this.server = await createServer({
        root: this.root,
        configFile: false,
        mode: 'development',
        logLevel: 'error',
        plugins: [weapp(), {
          name: 'sequence-framework-observation',
          enforce: 'post',
          configureServer: (server) => {
            this.watchers.track(server.watcher)
            const engine = (server.environments.client?.bundledDev as { _devEngine?: DevEngine } | undefined)?._devEngine
            if (engine) {
              this.engines.track(engine)
            }
          },
          load: (id) => { this.measurements.load(id) },
          transform: (_code, id) => { this.measurements.transform(id) },
          writeBundle: (_options, bundle) => { this.measurements.publish(Object.values(bundle)) },
        }],
        weapp: { srcRoot: 'src', vue: { enable: true }, autoRoutes: false, hmr: { runtime: this.stateful ? 'stateful-experimental' : 'classic' } },
        // classic 通过 Vite hotUpdate 调度快照；只关闭浏览器 WebSocket，保留文件更新事件。
        server: { host: '127.0.0.1', port: 0, hmr: true, ws: false },
        build: { outDir: this.outDir, emptyOutDir: false, minify: false, sourcemap: false },
      })
      await this.server.listen()
      await this.runtime.start()
    }
    const { pages: routes } = JSON.parse(input.files['src/app.json']!) as { pages: string[] }
    const source = input.files[`src/${routes[0]}.vue`]!
    const expected = /const message = "([^"]+)"/.exec(source)?.[1]
    if (!expected) {
      throw new Error('Framework resource fixture requires an explicit message literal')
    }
    if (!first && !this.stateful) {
      await this.waitUntil('classic output publication', async () => (await readFile(path.join(this.outDir, `${routes[0]}.js`), 'utf8')).includes(expected), input.signal)
      // classic 的宿主重载边界只重建测试 VM；Vite/编译器/worker 始终保持运行。
      await this.runtime.start()
    }
    await this.waitUntil('runtime message update', async () => await this.runtime.currentMessage() === expected, input.signal)
    return observeSettledSequencePublication(async () => {
      if (this.stateful) {
        const api: unknown = this.server?.config.plugins.find(plugin => plugin.name === 'weapp-vite:stateful-hmr-session')?.api
        if (!api || typeof api !== 'object' || !('whenSettled' in api) || typeof api.whenSettled !== 'function') {
          throw new Error('Framework resource observation requires the rebuilt stateful session settlement API')
        }
        await api.whenSettled()
      }
      else {
        await this.engine?.ensureCurrentBuildFinish()
      }
    }, async () => {
      const pages = await this.runtime.observe(routes)
      this.outputChanges = compareBenchmarkOutputs(before, await snapshotBenchmarkOutputs(this.outDir))
      return { files: await observePublishedFiles(this.outDir), pages }
    }, input.signal)
  }

  observeSession() {
    return { watchers: this.watchers.size, engines: this.engines.size }
  }

  private async waitUntil(stage: string, predicate: () => Promise<boolean>, signal: AbortSignal) {
    try {
      await bounded(async () => {
        while (!await predicate()) {
          signal.throwIfAborted()
          await new Promise(resolve => setTimeout(resolve, 20))
        }
      }, signal)
    }
    catch (error) {
      throw new Error(`Framework observation failed while waiting for ${stage}`, { cause: error })
    }
  }

  private async writeSources(input: SequenceInput) {
    const write = async (file: string, content: string) => {
      const target = path.join(this.root, file)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, content)
    }
    const mutate = async (action: Exclude<EditAction, { kind: 'rapid' }>, files: Record<string, string>) => {
      applyAction(files, action)
      if (action.kind === 'delete') {
        await rm(path.join(this.root, action.file), { force: true })
      }
      else if (action.kind === 'rename') {
        await mkdir(path.dirname(path.join(this.root, action.to)), { recursive: true })
        await rename(path.join(this.root, action.file), path.join(this.root, action.to))
      }
      else {
        await write(action.file, files[action.file]!)
      }
    }
    if (input.action) {
      const files = { ...this.files }
      for (const action of input.action.kind === 'rapid' ? input.action.saves : [input.action]) {
        await mutate(action, files)
      }
    }
    else {
      for (const [file, content] of Object.entries(input.files)) {
        await write(file, content)
      }
    }
    this.files = input.files
  }

  async close() {
    try {
      await this.runtime.close()
    }
    finally {
      await this.server?.close()
      this.server = undefined
    }
    if (this.watchers.size || this.engines.size) {
      throw new Error(`Framework host retained ${this.watchers.size} watchers and ${this.engines.size} native engines after close`)
    }
  }
}
