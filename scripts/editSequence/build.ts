import type { OutputBundle, PluginContext, RolldownOutput, RolldownWatcher } from 'rolldown'
import type { DevEngine } from 'rolldown/experimental'
import type { Plugin } from 'vite'
import type { StatefulHmrDevEngineUpdate } from '../../packages/weapp-vite/src/runtime/statefulHmr/viteAdapter'
import type { SequenceInput } from './driver'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'pathe'
import { build } from 'vite'
import { createStatefulHmrRolldownRuntimeSource } from '../../packages/weapp-vite/src/runtime/statefulHmr/commonRuntime'
import { toStableModuleId } from '../../packages/weapp-vite/src/runtime/statefulHmr/initialModuleGraph'
import { StatefulHmrOutputPublication } from '../../packages/weapp-vite/src/runtime/statefulHmr/outputPublication'
import { writeStatefulHmrOutput } from '../../packages/weapp-vite/src/runtime/statefulHmr/outputWriter'
import { createViteDevEngine } from '../../packages/weapp-vite/src/runtime/statefulHmr/viteDevEngine'
import { createSequenceFixturePlugin } from './buildFixture'
import { applyAction, bounded } from './driver'
import { observeError } from './editor'
import { observePublishedFiles, PublishedRuntime } from './published'

interface ModuleObservation {
  entry: boolean
  imports: string[]
  dynamicImports: string[]
}

interface PublicationReceipt {
  completion: PromiseWithResolvers<void>
  revision: number
  ready: boolean
}

export class BuildSequenceSession {
  private engine?: DevEngine
  private watcher?: RolldownWatcher
  private sourceFiles: Record<string, string> = {}
  private completion = Promise.withResolvers<void>()
  private failure: unknown
  private outputTask: Promise<void> = Promise.resolve()
  private readonly publication = new StatefulHmrOutputPublication()
  private readonly runtime = new PublishedRuntime()
  private modules: Record<string, ModuleObservation> = {}
  private entries: Record<string, string | null> = {}
  private readonly stateful: boolean
  private started = false
  private userFileInitialized = false
  private readonly watchedFiles = new Set<string>()
  private readonly pendingChanges = new Map<string, number>()
  private targetFiles: Readonly<Record<string, string>> = {}
  private writeRevision = 0
  private inputRevision = 0
  private publishedRevision = -1
  private writing = false

  constructor(mode: 'classic' | 'stateful-experimental', private readonly root: string, private readonly outDir: string) {
    this.stateful = mode === 'stateful-experimental'
  }

  async observe(input: SequenceInput) {
    const topologyChange = this.started && (
      Object.keys(input.files).some(file => !Object.hasOwn(this.sourceFiles, file))
      || Object.keys(this.sourceFiles).some(file => !Object.hasOwn(input.files, file))
    )
    const configChange = input.action?.kind === 'config' || (input.action?.kind === 'rapid' && input.action.saves.some(action => action.kind === 'config'))
    // classic 的新增/删除走完整构建边界；同一进程及输出目录仍保留缓存和历史产物供校验。
    const restart = configChange || (!this.stateful && topologyChange)
    if (restart) {
      await this.close()
    }
    const previousRevision = this.inputRevision
    this.targetFiles = input.files
    this.pendingChanges.clear()
    this.publishedRevision = -1
    this.completion = Promise.withResolvers<void>()
    void this.completion.promise.catch(() => {})
    this.writing = true
    try {
      await this.writeSources(input)
    }
    finally {
      this.writing = false
      this.completeIfPublished()
    }
    if (!this.started) {
      await mkdir(this.outDir, { recursive: true })
      // emptyOutDir:false 的用户边界；只在最初创建，后续绝不重写或清理。
      if (!this.userFileInitialized) {
        try {
          await writeFile(path.join(this.outDir, 'user-owned.txt'), 'owned by the user\n', { flag: 'wx' })
        }
        catch (error) {
          if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') {
            throw error
          }
        }
        this.userFileInitialized = true
      }
      await this.start()
    }
    else if (topologyChange && this.engine) {
      // 与生产会话的拓扑路径一致，新增/删除源请求原生完整发布，而非等待已有模块的文件监听。
      this.pendingChanges.clear()
      try {
        await this.publication.rebuild(this.engine, 5_000)
      }
      catch (error) {
        if (error !== this.failure) {
          throw error
        }
      }
    }
    else if (this.inputRevision === previousRevision) {
      // 没有改写引擎监听的输入时复用已发布状态，包括上一轮的诊断。
      this.finishPublication(this.capturePublication())
    }
    await bounded(() => this.completion.promise, input.signal)
    if (this.engine) {
      await bounded(() => this.engine!.ensureCurrentBuildFinish(), input.signal)
      if (this.failure === undefined) {
        await this.engine.getBundleState()
      }
    }
    await this.outputTask
    const userFile = await readFile(path.join(this.outDir, 'user-owned.txt'), 'utf8')
    if (userFile !== 'owned by the user\n') {
      throw new Error('emptyOutDir:false deleted or changed a user-owned file')
    }
    if (this.failure !== undefined) {
      // 失败轮没有可与全新失败构建比较的成功输出；下一次恢复必须比较全部发布态。
      return { diagnostics: [observeError(this.failure)] }
    }
    if (this.engine) {
      this.modules = {}
      for (const id of this.engine.moduleGraph.getModuleIds()) {
        const info = this.engine.moduleGraph.getModuleInfo(id)
        if (info) {
          this.modules[toStableModuleId(id, this.root)] = {
            entry: info.isEntry,
            imports: info.importedIds.map(dependency => toStableModuleId(dependency, this.root)).sort(),
            dynamicImports: info.dynamicallyImportedIds.map(dependency => toStableModuleId(dependency, this.root)).sort(),
          }
        }
      }
    }
    return {
      diagnostics: [],
      files: await observePublishedFiles(this.outDir),
      dependencies: this.modules,
      entries: this.entries,
      published: this.runtime.observe(this.stateful),
    }
  }

  private noteSourceWrite(file: string) {
    if (this.started) {
      this.pendingChanges.set(file, ++this.writeRevision)
      if (this.watchedFiles.has(file)) {
        this.inputRevision = this.writeRevision
      }
    }
  }

  private recordSourceInput(id: string) {
    const file = toStableModuleId(id, this.root)
    this.watchedFiles.add(file)
    this.inputRevision = Math.max(this.inputRevision, this.pendingChanges.get(file) ?? 0)
    return file
  }

  private async readSource(id: string) {
    const file = this.recordSourceInput(id)
    const revision = this.pendingChanges.get(file)
    const completion = this.completion
    let source: string | undefined
    let acknowledged = false
    try {
      source = await readFile(id, 'utf8')
      acknowledged = true
      return source
    }
    catch (error) {
      acknowledged = error instanceof Error && 'code' in error && error.code === 'ENOENT'
      throw error
    }
    finally {
      // 只确认引擎实际请求的输入；旧读取不能确认后续保存或后续步骤。
      if (acknowledged && completion === this.completion && this.pendingChanges.get(file) === revision && source === this.targetFiles[file]) {
        this.pendingChanges.delete(file)
      }
    }
  }

  private async acknowledgeSourceChange(id: string) {
    if (!this.pendingChanges.has(toStableModuleId(id, this.root))) {
      return
    }
    try {
      await this.readSource(id)
    }
    catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
        throw error
      }
    }
  }

  private hasPendingInputs() {
    for (const file of this.pendingChanges.keys()) {
      if (this.watchedFiles.has(file)) {
        return true
      }
    }
    return false
  }

  private capturePublication(): PublicationReceipt {
    return { completion: this.completion, revision: this.inputRevision, ready: !this.hasPendingInputs() }
  }

  private finishPublication(receipt: PublicationReceipt) {
    if (receipt.completion === this.completion && receipt.ready) {
      this.publishedRevision = Math.max(this.publishedRevision, receipt.revision)
      this.completeIfPublished()
    }
  }

  private completeIfPublished() {
    if (!this.writing && !this.hasPendingInputs() && this.publishedRevision === this.inputRevision) {
      this.completion.resolve()
    }
  }

  private async writeSources(input: SequenceInput) {
    const save = async (files: Readonly<Record<string, string>>) => {
      for (const file of Object.keys(this.sourceFiles)) {
        if (!Object.hasOwn(files, file)) {
          this.noteSourceWrite(file)
          await rm(path.join(this.root, file), { force: true })
        }
      }
      for (const [file, content] of Object.entries(files)) {
        if (this.sourceFiles[file] === content) {
          continue
        }
        const target = path.join(this.root, file)
        // fresh baseline 和活动 watcher 共享源码路径；相同字节不能再次触发活动构建。
        let current: string | undefined
        try {
          current = await readFile(target, 'utf8')
        }
        catch (error) {
          if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
            throw error
          }
        }
        if (current !== content) {
          this.noteSourceWrite(file)
          await mkdir(path.dirname(target), { recursive: true })
          await writeFile(`${target}.pending`, content)
          await rename(`${target}.pending`, target)
        }
      }
      this.sourceFiles = { ...files }
    }
    if (input.action?.kind === 'rename' && this.started) {
      const { file, to } = input.action
      this.noteSourceWrite(file)
      this.noteSourceWrite(to)
      await mkdir(path.dirname(path.join(this.root, to)), { recursive: true })
      await rename(path.join(this.root, file), path.join(this.root, to))
      applyAction(this.sourceFiles, input.action)
    }
    if (input.action?.kind === 'rapid' && this.started) {
      const intermediate = { ...this.sourceFiles }
      for (const action of input.action.saves) {
        if (action.kind === 'rename') {
          this.noteSourceWrite(action.file)
          this.noteSourceWrite(action.to)
          await mkdir(path.dirname(path.join(this.root, action.to)), { recursive: true })
          await rename(path.join(this.root, action.file), path.join(this.root, action.to))
          applyAction(this.sourceFiles, action)
        }
        applyAction(intermediate, action)
        await save(intermediate)
      }
    }
    await save(input.files)
  }

  private async start() {
    this.started = true
    this.watchedFiles.clear()
    const config = this.sourceFiles['sequence.config.json'] ? JSON.parse(this.sourceFiles['sequence.config.json']) as { define?: Record<string, string> } : {}
    const recordBundle = (bundle: OutputBundle, context: PluginContext) => {
      if (this.stateful) {
        return
      }
      this.entries = Object.fromEntries(Object.values(bundle).flatMap(item => item.type === 'chunk' && item.isEntry
        ? [[item.fileName, item.facadeModuleId && toStableModuleId(item.facadeModuleId, this.root)]]
        : []))
      this.modules = {}
      for (const id of context.getModuleIds()) {
        const info = context.getModuleInfo(id)
        if (info) {
          this.modules[toStableModuleId(id, this.root)] = {
            entry: info.isEntry,
            imports: info.importedIds.map(dependency => toStableModuleId(dependency, this.root)).sort(),
            dynamicImports: info.dynamicallyImportedIds.map(dependency => toStableModuleId(dependency, this.root)).sort(),
          }
        }
      }
    }
    const recordWatchFiles = (context: PluginContext) => {
      this.watchedFiles.clear()
      for (const id of context.getModuleIds()) {
        this.recordSourceInput(id)
        const dependencies = context.getModuleInfo(id)?.meta.editSequenceWatchFiles as readonly string[] | undefined
        if (dependencies) {
          for (const dependency of dependencies) {
            this.recordSourceInput(dependency)
          }
        }
      }
    }
    const observer: Plugin = {
      name: 'edit-sequence-read-only-observer',
      load: async (id) => {
        this.recordSourceInput(id)
        await this.acknowledgeSourceChange(id)
        return null
      },
      watchChange: id => this.acknowledgeSourceChange(id),
      buildStart: async () => {
        // 原生错误恢复可直接进入完整构建，不一定先发送 watchChange。
        for (const file of this.pendingChanges.keys()) {
          if (this.watchedFiles.has(file)) {
            await this.acknowledgeSourceChange(path.join(this.root, file))
          }
        }
      },
      buildEnd(error) {
        // 失败的 transform 可能尚未返回外部依赖元数据，保留本轮实际请求过的输入。
        if (!error) {
          recordWatchFiles(this)
        }
      },
      generateBundle(_options, bundle) {
        recordBundle(bundle, this)
      },
    }
    const plugins = [createSequenceFixturePlugin(this.root, this.stateful, id => this.readSource(id)), observer]
    const output = { dir: this.outDir, format: 'cjs' as const, entryFileNames: '[name].js', chunkFileNames: '[name].js', sourcemap: false as const }
    if (!this.stateful) {
      const result = await build({
        root: this.root,
        configFile: false,
        publicDir: false,
        logLevel: 'silent',
        define: config.define,
        plugins,
        build: { emptyOutDir: false, minify: false, watch: { buildDelay: 20 }, rolldownOptions: { preserveEntrySignatures: 'strict', input: { main: path.join(this.root, 'main.js') }, output } },
      })
      if (!('on' in result)) {
        throw new Error('Classic watch did not return a watcher')
      }
      this.watcher = result
      let buildFailed = false
      result.on('event', (event) => {
        if (event.code === 'START') {
          buildFailed = false
        }
        else if (event.code === 'ERROR') {
          buildFailed = true
          this.failure = event.error
          this.finishPublication(this.capturePublication())
        }
        else if (event.code === 'END' && !buildFailed) {
          const receipt = this.capturePublication()
          this.outputTask = this.runtime.load(this.outDir).then(() => {
            this.failure = undefined
            this.finishPublication(receipt)
          })
          void this.outputTask.catch(error => receipt.completion.reject(error))
          return this.outputTask
        }
      })
      return
    }
    this.engine = await createViteDevEngine({
      cwd: this.root,
      input: { main: path.join(this.root, 'main.js') },
      transform: { define: config.define },
      plugins,
      experimental: { devMode: { lazy: false, implement: createStatefulHmrRolldownRuntimeSource() } },
    }, output, {
      watch: { skipWrite: true, usePolling: true, pollInterval: 20, compareContentsForPolling: false },
      onOutput: result => this.publish(result),
      onAdditionalAssets: result => this.publish(result, true),
      onHmrUpdates: (result) => {
        const receipt = this.capturePublication()
        if (result instanceof Error) {
          this.failure = result
          this.finishPublication(receipt)
          return
        }
        // 不在原生回调中等待当前原生事务，否则 FullReload 的完成屏障会等待自己。
        const updates = async () => {
          for (const item of result.updates) {
            const update = item.update as StatefulHmrDevEngineUpdate
            if (update.type === 'Patch') {
              this.runtime.apply(update)
              await this.engine!.notifyPayloadDelivered(update.filename)
            }
            else if (update.type === 'FullReload') {
              // 与生产 adapter 相同，只在引擎要求 reload 时请求完整发布。
              await this.publication.rebuild(this.engine!, 5_000)
            }
          }
          await this.outputTask
          this.failure = undefined
          this.finishPublication(receipt)
        }
        void updates().catch(error => receipt.completion.reject(error))
      },
    })
    await this.engine.registerClient('edit-sequence')
    await this.engine.run()
  }

  private publish(result: Error | RolldownOutput, additional = false) {
    const receipt = this.capturePublication()
    if (result instanceof Error) {
      this.failure = result
      this.finishPublication(receipt)
      return this.publication.publish(additional ? 'additional' : 'full', () => {
        throw result
      })
    }
    const previous = this.outputTask
    this.outputTask = this.publication.publish(additional ? 'additional' : 'full', async () => {
      await previous
      await writeStatefulHmrOutput(this.outDir, result.output)
      if (!additional) {
        this.entries = Object.fromEntries(result.output.flatMap(item => item.type === 'chunk' && item.isEntry
          ? [[item.fileName, item.facadeModuleId && toStableModuleId(item.facadeModuleId, this.root)]]
          : []))
        await this.runtime.load(this.outDir)
        for (const output of result.output) {
          if (output.type === 'chunk') {
            await this.engine?.notifyPayloadDelivered(output.fileName)
          }
        }
        this.failure = undefined
        this.finishPublication(receipt)
      }
    })
    void this.outputTask.catch(error => receipt.completion.reject(error))
    return this.outputTask
  }

  async close() {
    await this.watcher?.close()
    await this.engine?.close()
    await this.outputTask
    this.watcher = undefined
    this.engine = undefined
    this.started = false
  }
}
