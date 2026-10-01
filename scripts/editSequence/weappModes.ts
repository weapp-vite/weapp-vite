import type { RolldownWatcher } from 'rolldown'
import type { SequenceInput } from './driver'
import type { OutputSnapshot } from './outputCache'
import { access, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { build } from 'vite'
import { weapp } from 'weapp-vite/vite'
import { bounded } from './driver'
import { restoreOwnedOutputs, retireOwnedOutputs } from './outputCache'

interface ModeConfig {
  pipeline: Array<'dev' | 'production'>
  emptyOutDir: boolean
  restoreInitialCache?: boolean
}

/** 全量读取最终磁盘文件；不按 manifest 过滤，因此遗留 chunk 也会造成比较失败。 */
export async function readOutputSnapshot(outDir: string): Promise<OutputSnapshot> {
  const result: OutputSnapshot = {}
  for (const entry of await readdir(outDir, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) {
      const absolute = path.join(entry.parentPath, entry.name)
      result[path.relative(outDir, absolute).replaceAll('\\', '/')] = (await readFile(absolute)).toString('base64')
    }
  }
  return result
}

/** 使用完整 weapp 插件的模式切换观察器，production 基线在独立 worker 中重建。 */
export class WeappModeSequenceSession {
  private files: Readonly<Record<string, string>> = {}
  private owned: OutputSnapshot = {}
  private cached: OutputSnapshot | undefined
  private watcher: RolldownWatcher | undefined
  private readonly outDir: string

  constructor(private readonly root: string, private readonly fresh: boolean) {
    this.outDir = path.join(root, 'dist')
  }

  async observe(input: SequenceInput) {
    const config = JSON.parse(input.files['sequence.config.json']!) as ModeConfig
    const initial = Object.keys(this.files).length === 0
    for (const file of Object.keys(this.files)) {
      if (!Object.hasOwn(input.files, file)) {
        await rm(path.join(this.root, file), { force: true })
      }
    }
    for (const [file, content] of Object.entries(input.files)) {
      await mkdir(path.dirname(path.join(this.root, file)), { recursive: true })
      await writeFile(path.join(this.root, file), content)
    }
    this.files = input.files
    await mkdir(this.outDir, { recursive: true })
    if (!config.emptyOutDir && initial) {
      await writeFile(path.join(this.outDir, 'user-owned.txt'), 'owned by another tool')
    }
    if (config.restoreInitialCache && !this.fresh) {
      if (!this.cached) {
        throw new Error('No prior production cache to restore')
      }
      await restoreOwnedOutputs(this.outDir, this.owned, this.cached)
      this.owned = this.cached
    }
    for (const mode of this.fresh ? ['production'] as const : config.pipeline) {
      let emitted: string[] = []
      let references: string[] = []
      const result = await build({
        root: this.root,
        configFile: false,
        mode: mode === 'dev' ? 'development' : 'production',
        logLevel: 'silent',
        plugins: [weapp(), {
          name: 'sequence-output-manifest',
          writeBundle: {
            order: 'post',
            handler(_options, bundle) {
              emitted = Object.keys(bundle)
              references = Object.values(bundle).flatMap(item => item.type === 'chunk' ? [...item.imports, ...item.dynamicImports] : [])
            },
          },
        }],
        weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false },
        build: { outDir: this.outDir, emptyOutDir: config.emptyOutDir, minify: true, sourcemap: false, watch: mode === 'dev' ? {} : null },
      })
      if (mode === 'dev') {
        this.watcher = result as RolldownWatcher
        const ready = Promise.withResolvers<void>()
        this.watcher.on('event', (event) => {
          if (event.code === 'ERROR') {
            ready.reject(event.error)
          }
          if (event.code === 'END') {
            ready.resolve()
          }
        })
        try {
          await bounded(() => ready.promise, input.signal)
        }
        finally {
          await this.close()
        }
      }
      const next: OutputSnapshot = {}
      for (const file of emitted) {
        next[file] = (await readFile(path.join(this.outDir, file))).toString('base64')
      }
      if (!config.emptyOutDir) {
        // 每次新构建上下文没有旧会话所有权；跨模式/外部缓存的清理由集成层负责。
        await retireOwnedOutputs(this.outDir, this.owned, next)
      }
      this.owned = next
      for (const reference of references) {
        await access(path.join(this.outDir, reference))
      }
      if (!config.emptyOutDir && await readFile(path.join(this.outDir, 'user-owned.txt'), 'utf8') !== 'owned by another tool') {
        throw new Error('Mode transition changed user-owned content')
      }
    }
    const app = JSON.parse(await readFile(path.join(this.outDir, 'app.json'), 'utf8')) as { pages: string[], subPackages?: Array<{ root: string, pages: string[] }> }
    for (const page of [...app.pages, ...(app.subPackages ?? []).flatMap(pkg => pkg.pages.map(page => `${pkg.root}/${page}`))]) {
      for (const extension of ['js', 'wxml', 'json']) {
        await access(path.join(this.outDir, `${page}.${extension}`))
      }
    }
    this.cached ??= { ...this.owned }
    return readOutputSnapshot(this.outDir)
  }

  async close() {
    await this.watcher?.close()
    this.watcher = undefined
  }
}
