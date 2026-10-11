import type { EventEmitter } from 'node:events'
import type { OutputBundle } from 'rolldown'
import type { InlineConfig, Plugin } from 'vite'
import { mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { expect, vi } from 'vitest'
import { createTestCompilerContext } from '../utils'

interface SnapshotHarness {
  build: ReturnType<typeof vi.fn>
  change?: (change: { event: 'update' | 'create', file: string }) => void
  sidecars: EventEmitter[]
}

/** 只替换外部文件事件；入口发射、发布清单和磁盘写出均由真实编译器与 Vite 执行。 */
export async function createSnapshotTemplateFixture(harness: SnapshotHarness, cleanups: Array<() => Promise<void>>) {
  const root = path.normalize(await realpath(await mkdtemp(path.join(os.tmpdir(), 'classic-template-snapshot-'))))
  cleanups.push(async () => await rm(root, { recursive: true, force: true }))
  const absolute = (file: string) => path.join(root, 'src', file)
  const files = {
    'app.ts': 'App({})',
    'app.json': JSON.stringify({ pages: ['pages/home/index', 'pages/unrelated/index'] }),
    'pages/home/index.ts': 'Page({})',
    'pages/home/index.json': JSON.stringify({ usingComponents: { 'fixture-layout': '../../components/layout/index' } }),
    'pages/home/index.wxml': '<fixture-layout/>',
    'components/layout/index.ts': 'Component({})',
    'components/layout/index.json': '{"component":true}',
    'components/layout/index.wxml': '<import src="../../shared/card.wxml"/><include src="../../shared/wrapper.wxml"/><template is="card"/>',
    'shared/card.wxml': '<template name="card"><view>card initial</view></template>',
    'shared/wrapper.wxml': '<include src="./partial.wxml"/>',
    'shared/partial.wxml': '<view>partial initial</view>',
    'pages/unrelated/index.ts': 'Page({})',
    'pages/unrelated/index.json': '{}',
    'pages/unrelated/index.wxml': '<view>unrelated page</view>',
  }
  for (const [file, source] of Object.entries(files)) {
    await mkdir(path.dirname(absolute(file)), { recursive: true })
    await writeFile(absolute(file), source)
  }
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'classic-template-snapshot', private: true, type: 'module' }))
  await writeFile(path.join(root, 'project.config.json'), JSON.stringify({
    appid: 'wxb3d842a4a7e3440d',
    compileType: 'miniprogram',
    miniprogramRoot: 'dist/',
    srcMiniprogramRoot: 'src/',
  }))
  const compiler = await createTestCompilerContext({
    cwd: root,
    isDev: true,
    inlineConfig: {
      configFile: false,
      publicDir: false,
      logLevel: 'silent',
      weapp: {
        srcRoot: 'src',
        autoRoutes: false,
        hmr: { runtime: 'classic' },
        cleanOutputsInDev: false,
        vue: { enable: false },
        npm: { enable: false },
      },
    },
  })
  cleanups.push(async () => {
    await compiler.ctx.watcherService.closeAll()
    await compiler.dispose()
  })
  const { build: nativeBuild } = await vi.importActual<typeof import('vite')>('vite')
  const bundles: OutputBundle[] = []
  const writes: string[][] = []
  const failures: unknown[] = []
  const controls = { beforeRender: undefined as (() => Promise<void>) | undefined, failAfterRender: false }
  harness.build.mockImplementation(async (config: InlineConfig) => {
    const observer: Plugin = {
      name: 'test:classic-snapshot-publication',
      enforce: 'post',
      configResolved(resolved) {
        // 保证失败注入位于真实 generateBundle 发布之后、原生写盘之前。
        const publisher = resolved.plugins.findIndex(plugin => plugin.name === 'weapp-vite:output-publication')
        const observerIndex = resolved.plugins.findIndex(plugin => plugin.name === 'test:classic-snapshot-publication')
        expect(publisher).toBeGreaterThanOrEqual(0)
        expect(observerIndex).toBeGreaterThan(publisher)
      },
      buildEnd: {
        order: 'pre',
        sequential: true,
        async handler(error) {
          if (!error) {
            await controls.beforeRender?.()
          }
        },
      },
      generateBundle: {
        order: 'post',
        handler() {
          if (controls.failAfterRender) {
            controls.failAfterRender = false
            throw new Error('simulated write failure')
          }
        },
      },
      writeBundle: {
        order: 'post',
        sequential: true,
        handler(_options, bundle) {
          writes.push(Object.keys(bundle))
        },
      },
    }
    const result = await nativeBuild({ ...config, plugins: [...config.plugins ?? [], observer] }).catch((error: unknown) => {
      failures.push(error)
      throw error
    })
    if (Array.isArray(result) || !('output' in result)) {
      throw new Error('Expected one completed native snapshot output')
    }
    bundles.push(Object.fromEntries(result.output.map(output => [output.fileName, output])) as OutputBundle)
    return result
  })
  const watcher = await compiler.ctx.buildService.build({ skipNpm: true })
  if (!watcher || !('close' in watcher)) {
    throw new Error('Expected the classic snapshot scheduler')
  }
  cleanups.push(async () => await watcher.close())
  const sidecar = harness.sidecars.find(watcher => watcher.listenerCount('all') > 0)
  if (!sidecar) {
    throw new Error('Missing snapshot sidecar event source')
  }
  const save = async (file: string, source: string) => {
    const temporary = `${absolute(file)}.save`
    await writeFile(temporary, source)
    await rename(temporary, absolute(file))
  }
  const update = (...files: string[]) => {
    if (!harness.change) {
      throw new Error('Missing snapshot graph event source')
    }
    for (const file of files) {
      harness.change({ event: 'update', file: absolute(file) })
    }
  }
  const nextBundle = async (previousCount: number) => {
    await vi.waitFor(() => expect(bundles).toHaveLength(previousCount + 1))
    expect(writes).toHaveLength(bundles.length)
    return bundles.at(-1)!
  }
  const nextFailure = async (previousCount: number) => {
    await vi.waitFor(() => expect(failures).toHaveLength(previousCount + 1))
    return failures.at(-1)
  }
  const readOutput = (file: string) => readFile(path.join(compiler.ctx.configService.outDir, file), 'utf8')
  return { ctx: compiler.ctx, files, absolute, save, update, bundles, nextBundle, failures, nextFailure, controls, sidecar, readOutput, writes }
}
