import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import type { HmrRuntimeSession } from '../hmrRuntimeSession'
import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import process from 'node:process'
import { WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE } from '@weapp-core/constants'
import path from 'pathe'
import { expect, it, onTestFailed } from 'vitest'
import { ensureWorkspacePackageLink } from '../../../test/utils'
import { CompilerSession } from '../compilerSession'
import { getHmrRuntimeSession } from '../hmrRuntimeSession'
import { ownsSidecarDelivery } from '../watch/sidecarDelivery'

async function within<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), 30_000)
      }),
    ])
  }
  finally {
    clearTimeout(timer)
  }
}

it('publishes an imported native stylesheet saved after the first classic write while handoff is switching', async () => {
  const root = path.normalize(await realpath(await mkdtemp(path.join(os.tmpdir(), 'native-style-handoff-'))))
  const source = path.join(root, 'src/styles/theme.wxss')
  const styleName = 'pages/imported/index.wxss'
  const outDir = path.join(root, 'dist')
  const initial = '.imported { color: #123; }'
  const readStyle = () => readFile(path.join(outDir, styleName), 'utf8')
  const wroteFallback = Promise.withResolvers<void>()
  const releasePublication = Promise.withResolvers<void>()
  const observedNextSave = Promise.withResolvers<void>()
  const publications: Array<{ phase: string, colors: string[] }> = []
  const graphObservations: Array<{ stage: string, phase: string | undefined, hasModule: boolean, affectedEntries: string[] }> = []
  const buildErrors: string[] = []
  let runtime: HmrRuntimeSession | undefined
  let moduleGraph: CompilerContext['moduleGraphService'] | undefined
  let publicationBlocked = false
  let blockFallbackWrite = true
  let phase = 'fixture'
  const compiler = new CompilerSession()
  const observeGraph = (stage: string) => {
    if (moduleGraph) {
      graphObservations.push({
        stage,
        phase: runtime?.phase,
        hasModule: moduleGraph.hasModule(source),
        affectedEntries: [...moduleGraph.collectAffectedEntries(source)].map(id => path.relative(root, id)),
      })
    }
  }
  const probe: Plugin = {
    name: 'native-style-handoff-publication-probe',
    enforce: 'post',
    writeBundle: {
      order: 'pre',
      sequential: true,
      async handler(_options, bundle) {
        if (!runtime || runtime.phase === 'stateful' || !bundle[styleName]) {
          return
        }
        const output = await readStyle()
        publications.push({ phase: runtime.phase, colors: output.match(/#[a-f\d]{3,6}\b/gi) ?? [] })
        if (!blockFallbackWrite || !output.includes('#456')) {
          return
        }
        blockFallbackWrite = false
        publicationBlocked = true
        try {
          expect(runtime.phase).toBe('switching')
          // 原生 write 已完成，core 的 post writeBundle 尚未预热依赖图；真实保存不能丢失。
          expect(output).toContain('#456')
          observeGraph('native-write-before-core-graph-sync')
          wroteFallback.resolve()
          await releasePublication.promise
        }
        catch (error) {
          wroteFallback.reject(error)
          throw error
        }
        finally {
          publicationBlocked = false
        }
      },
    },
    hotUpdate({ file }) {
      if (!publicationBlocked || path.resolve(file) !== source) {
        return
      }
      try {
        if (readFileSync(source, 'utf8') === initial.replace('#123', '#789')) {
          observeGraph('real-hot-update-during-publication')
          observedNextSave.resolve()
        }
      }
      catch (error) {
        observedNextSave.reject(error)
      }
    },
  }
  const save = async (color: string) => {
    const temporary = `${source}.save.tmp`
    await writeFile(temporary, initial.replace('#123', color))
    await rename(temporary, source)
  }
  onTestFailed(() => {
    process.stderr.write(`[native-style-handoff] ${JSON.stringify({ phase, runtimePhase: runtime?.phase, fallback: runtime?.fallback?.code, publicationBlocked, publications, graphObservations, buildErrors })}\n`)
  })
  try {
    for (const [file, content] of Object.entries({
      'package.json': '{"name":"native-style-handoff-fixture","private":true,"type":"module"}',
      'project.config.json': '{"appid":"wxb3d842a4a7e3440d","compileType":"miniprogram","miniprogramRoot":"dist/","srcMiniprogramRoot":"src/"}',
      'project.private.config.json': '{"setting":{"compileHotReLoad":true},"condition":{"miniprogram":{"list":[{"name":"Imported style","pathName":"pages/imported/index"}]}}}',
      'src/app.js': 'App({})',
      'src/app.json': '{"pages":["pages/imported/index"]}',
      'src/pages/imported/index.js': 'Page({ data: { message: "native imported style" } })',
      'src/pages/imported/index.json': '{}',
      'src/pages/imported/index.wxml': '<view class="imported">{{message}}</view>',
      'src/pages/imported/index.wxss': '@import "../../styles/theme.wxss";',
      'src/styles/theme.wxss': initial,
    })) {
      const absolute = path.join(root, file)
      await mkdir(path.dirname(absolute), { recursive: true })
      await writeFile(absolute, content)
    }
    await ensureWorkspacePackageLink(root)
    const ctx = await compiler.initialize({
      cwd: root,
      isDev: true,
      preloadAppEntry: false,
      syncAutoImportSupportFiles: false,
      inlineConfig: {
        configFile: false,
        publicDir: false,
        logLevel: 'silent',
        plugins: [probe],
        weapp: { srcRoot: 'src', autoRoutes: false, hmr: { runtime: 'stateful-experimental' }, vue: { enable: false }, npm: { enable: false } },
        build: { minify: false, cssMinify: false, emptyOutDir: false },
        server: { host: '127.0.0.1', port: 0 },
      },
    })
    moduleGraph = ctx.moduleGraphService
    runtime = getHmrRuntimeSession(ctx)
    const watcher = await compiler.run(() => ctx.buildService.build({ skipNpm: true }))
    if (!watcher || !('on' in watcher)) {
      throw new Error('Expected the wv development build to return its native watcher')
    }
    watcher.on('event', (event) => {
      if (event.code === 'ERROR') {
        buildErrors.push(event.error.message)
      }
    })
    expect(await readStyle()).toContain('#123')
    expect(runtime.phase).toBe('stateful')

    phase = 'saving-fallback-color'
    await save('#456')
    await within(wroteFallback.promise, 'the first native classic write')
    expect(runtime.fallback?.code).toBe('stylesheet-output')
    expect(runtime.phase).toBe('switching')
    expect(await readStyle()).toContain('#456')
    expect(ownsSidecarDelivery(compiler.context, source, 'update')).toBe(true)

    phase = 'saving-during-classic-publication'
    await save('#789')
    await within(observedNextSave.promise, 'a real watcher observing the next imported stylesheet save')
    expect(runtime.phase).toBe('switching')
    expect(publicationBlocked).toBe(true)
    expect(await readFile(source, 'utf8')).toContain('#789')
    releasePublication.resolve()

    phase = 'publishing-the-save-captured-during-handoff'
    await within(runtime.whenSettled(), 'classic handoff settlement')
    observeGraph('classic-handoff-settled')
    await expect.poll(readStyle, { timeout: 30_000 }).toContain('#789')
    await expect.poll(() => publications.some(item => item.colors.includes('#789')), { timeout: 30_000 }).toBe(true)
    expect(runtime.phase).toBe('classic')
    for (const file of [WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE]) {
      await expect(readFile(path.join(outDir, file))).rejects.toMatchObject({ code: 'ENOENT' })
    }

    for (const color of ['#123', '#abc', '#123']) {
      phase = `saving-after-handoff-${color}`
      const cursor = publications.length
      await save(color)
      await expect.poll(readStyle, { timeout: 30_000 }).toContain(color)
      await expect.poll(() => publications.slice(cursor).some(item => item.colors.includes(color)), { timeout: 30_000 }).toBe(true)
      expect(runtime.phase).toBe('classic')
      expect(runtime.fallback?.code).toBe('stylesheet-output')
    }
    expect(buildErrors).toEqual([])
    if (process.env.WEAPP_VITE_HMR_STYLE_HANDOFF_DIAGNOSTICS === '1') {
      process.stdout.write(`[native-style-handoff:passed] ${JSON.stringify({ publications, graphObservations })}\n`)
    }
  }
  finally {
    releasePublication.resolve()
    try {
      await compiler.close()
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  }
}, 120_000)
