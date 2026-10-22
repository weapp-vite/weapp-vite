import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { waitForStableDistSnapshot } from '../../scripts/workspace-hmr/output'
import { runCleanupSteps } from '../utils/cleanupSteps'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrFailureDiagnostics } from '../utils/hmrFailureDiagnostics'
import { saveNativeProfileSource } from '../utils/nativeProfileProject'
import { runWithCleanup } from '../utils/runWithCleanup'

const ROOT = path.resolve(import.meta.dirname, '../..')
const CLI = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const PAGE = 'pages/index/index'
const COMPONENT = 'components/unrelated/index'
const STYLE = 'view { color: #123456; --prelude-generation: initial; }'
const TEMPLATE = '<view><unrelated-card />initial-template</view>'
const OBSERVED_FILES = ['dist/app.js', 'dist/app.prelude.js', `dist/${COMPONENT}.js`, `dist/${PAGE}.wxml`, `dist/${PAGE}.wxss`]

async function createProject(runtime: 'classic' | 'stateful-experimental') {
  const parent = path.join(ROOT, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const project = await mkdtemp(path.join(parent, 'request-globals-prelude-'))
  const files = {
    'package.json': JSON.stringify({ name: 'request-globals-prelude-regression', private: true, type: 'module' }),
    'project.config.json': JSON.stringify({ appid: 'wxb3d842a4a7e3440d', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
    'project.private.config.json': JSON.stringify({ setting: { compileHotReLoad: true }, condition: { miniprogram: { list: [{ name: 'Prelude generations', pathName: PAGE, query: '', scene: null }] } } }),
    'weapp-vite.config.ts': `import { defineConfig } from 'weapp-vite'
export default defineConfig({
  build: { minify: false },
  weapp: {
    srcRoot: 'src', autoRoutes: false, npm: { enable: false }, mcp: false,
    hmr: { runtime: '${runtime}' },
    appPrelude: { webRuntime: { enabled: true, targets: ['AbortController', 'AbortSignal'] } },
  },
})`,
    'src/app.js': 'App({ globalData: { entryReady: new AbortController().signal.aborted === false } })',
    'src/app.json': JSON.stringify({ pages: [PAGE] }),
    [`src/${PAGE}.js`]: 'Page({ data: { pageReady: new AbortController().signal.aborted === false } })',
    [`src/${PAGE}.json`]: JSON.stringify({ usingComponents: { 'unrelated-card': `/${COMPONENT}` } }),
    [`src/${PAGE}.wxml`]: TEMPLATE,
    [`src/${PAGE}.wxss`]: STYLE,
    [`src/${COMPONENT}.js`]: 'Component({ data: { marker: "unchanged-component", componentReady: new AbortController().signal.aborted === false } })',
    [`src/${COMPONENT}.json`]: JSON.stringify({ component: true }),
    [`src/${COMPONENT}.wxml`]: '<view>{{marker}}</view>',
  }
  try {
    for (const [relative, source] of Object.entries(files)) {
      const file = path.join(project, relative)
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(file, source)
    }
    await mkdir(path.join(project, 'node_modules'))
    await symlink(await realpath(path.join(ROOT, 'packages/weapp-vite')), path.join(project, 'node_modules/weapp-vite'), 'junction')
    return project
  }
  catch (error) {
    await rm(project, { recursive: true, force: true })
    throw error
  }
}

/** 每代冷执行真实 emitted CommonJS，不能让上一代已安装的全局值掩盖空 prelude。 */
function executePublication(dist: string) {
  const registrations: { app?: unknown, page?: unknown, component?: unknown } = {}
  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    wx: {},
    App: (options: unknown) => registrations.app = options,
    Page: (options: unknown) => registrations.page = options,
    Component: (options: unknown) => registrations.component = options,
  })
  const cache = new Map<string, { exports: unknown }>()
  function load(file: string): unknown {
    const relative = path.relative(dist, file)
    if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
      throw new Error('Emitted module escaped its fixture publication')
    }
    const cached = cache.get(file)
    if (cached) {
      return cached.exports
    }
    const module: { exports: unknown } = { exports: {} }
    cache.set(file, module)
    const code = readFileSync(file, 'utf8')
    if (file.endsWith('.json')) {
      module.exports = JSON.parse(code)
      return module.exports
    }
    const run = vm.runInContext(`(function(module, exports, require) {\n${code}\n})`, context, { filename: relative.replaceAll('\\', '/') })
    run(module, module.exports, (request: string) => {
      if (!request.startsWith('.')) {
        throw new Error(`Unexpected external emitted module: ${request}`)
      }
      return load(path.resolve(path.dirname(file), request))
    })
    return module.exports
  }
  load(path.join(dist, 'app.js'))
  load(path.join(dist, `${PAGE}.js`))
  load(path.join(dist, `${COMPONENT}.js`))
  return registrations
}

describe.each(['classic', 'stateful-experimental'] as const)('request globals publication generations (%s)', (runtime) => {
  it('keeps prelude initialization and unrelated components stable across stylesheet and template saves', async (context) => {
    const project = await createProject(runtime)
    const dist = path.join(project, 'dist')
    let diagnostics: Awaited<ReturnType<typeof createHmrFailureDiagnostics>>
    let controller: ReturnType<typeof startDevProcess> | undefined
    let stage = 'initial-setup'
    let failed = false
    const read = (relative: string) => readFile(path.join(dist, relative), 'utf8')
    await runWithCleanup(async () => {
      try {
        diagnostics = await createHmrFailureDiagnostics(`request-globals-prelude-${runtime}`)
        const dev = startDevProcess(process.execPath, [CLI, 'dev', '--non-interactive'], {
          cwd: project,
          env: { ...createDevProcessEnv(), ...diagnostics?.env },
          all: true,
        })
        controller = dev
        context.onTestFailed(() => {
          process.stdout.write(dev.getOutput())
        })
        stage = 'initial-build'
        await dev.waitForInitialBuild()
        // 先进入同模式 classic，再冻结基线；首次能力转换的完整发布不计为无关增量。
        if (runtime === 'stateful-experimental') {
          stage = 'classic-transition'
          await saveNativeProfileSource(project, `${PAGE}.wxss`, STYLE.replace('initial', 'classic-transition'))
          await dev.waitForOutput('HMR classic ready', 'classic publication after stylesheet fallback')
          await dev.waitFor(expect.poll(() => read(`${PAGE}.wxss`), { timeout: 30_000 }).toContain('classic-transition'), 'stylesheet transition output')
        }
        await dev.waitFor(waitForStableDistSnapshot(dist, 600, 30_000), 'stable classic baseline')
        const baseline = {
          prelude: await read('app.prelude.js'),
          component: await read(`${COMPONENT}.js`),
          runtime: executePublication(dist),
        }
        expect(baseline.prelude.trim()).not.toBe('')
        expect(baseline.runtime).toMatchObject({
          app: { globalData: { entryReady: true } },
          page: { data: { pageReady: true } },
          component: { data: { marker: 'unchanged-component', componentReady: true } },
        })
        await diagnostics?.snapshot('classic-baseline', project, OBSERVED_FILES)
        const changes = [
          { file: `${PAGE}.wxss`, source: STYLE.replace('initial', 'style-first'), marker: 'style-first' },
          { file: `${PAGE}.wxss`, source: STYLE.replace('initial', 'style-next'), marker: 'style-next' },
          { file: `${PAGE}.wxss`, source: STYLE, marker: 'initial' },
          { file: `${PAGE}.wxml`, source: TEMPLATE.replace('initial-template', 'next-template'), marker: 'next-template' },
          { file: `${PAGE}.wxml`, source: TEMPLATE, marker: 'initial-template' },
        ]
        for (const change of changes) {
          stage = change.marker
          await saveNativeProfileSource(project, change.file, change.source)
          await dev.waitFor(expect.poll(() => read(change.file), { timeout: 30_000 }).toContain(change.marker), `${change.file} publishes ${change.marker}`)
          await dev.waitFor(waitForStableDistSnapshot(dist, 600, 30_000), `stable classic ${stage}`)
          await diagnostics?.snapshot(stage, project, OBSERVED_FILES)
          expect(executePublication(dist), `${stage} cold initialization retains real constructors`).toEqual(baseline.runtime)
          expect(await read('app.prelude.js'), `${stage} keeps its executable prelude`).toBe(baseline.prelude)
          expect(await read(`${COMPONENT}.js`), `${stage} does not rewrite an unrelated component`).toBe(baseline.component)
        }
        expect(dev.getOutput()).not.toMatch(/Build failed|delivery failed|patch transform failed/)
      }
      catch (error) {
        failed = true
        throw error
      }
    }, async () => {
      let released = controller === undefined
      await runCleanupSteps([
        { label: 'prelude fixture dev process', run: async () => {
          if (controller) {
            await controller.stop(5_000)
            released = true
          }
        } },
        { label: 'prelude fixture failure evidence', run: async () => {
          if (failed || !released) {
            await diagnostics?.failure(project, controller?.getOutput() ?? '', { runtime, stage, released })
          }
        } },
        { label: 'prelude fixture directory', run: async () => {
          if (released) {
            await rm(project, { recursive: true, force: true })
          }
        } },
      ])
    })
  }, 180_000)
})
