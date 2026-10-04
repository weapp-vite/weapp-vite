import type { OutputAsset, OutputChunk } from 'rolldown'
import type { InlineConfig } from 'vite'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { build } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { createGlassEaselAnalyzeResult } from '../../analyze/glassEasel'
import { createCompilerContextInstance } from '../../context/createCompilerContextInstance'
import { createLogicalEntryId } from '../../moduleGraph/protocol'
import { compilerSourceId } from '../../plugins/compilerPlugin/hmr'
import { resetRuntimeStateForFreshBuild } from '../resetRuntimeState'
import { createRuntimeState } from '../runtimeState'
import { createSharedBuildConfig } from '../sharedBuildConfig'
import { syncProjectSupportFiles } from '../supportFiles'
import { buildStatefulHmrSnapshot } from './snapshotBuild'
import { validateSnapshotInputs } from './snapshotInputs'

const temporaryRoots: string[] = []

async function createProject(autoImport = false, withWorker = false) {
  const root = path.normalize(await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-snapshot-component-'))))
  temporaryRoots.push(root)
  const files = {
    'package.json': JSON.stringify({ name: 'snapshot-component-regression', private: true, dependencies: { wevu: '*' } }),
    'project.config.json': JSON.stringify({ appid: 'wx1234567890abcd', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
    'vite.config.ts': [
      `import { defineConfig } from ${JSON.stringify(path.resolve(import.meta.dirname, '../../config.ts'))}`,
      `export default defineConfig({ weapp: { srcRoot: "src", react: { renderMode: "auto", compiler: false }, ${autoImport ? 'autoImportComponents: { globs: ["components/**/*"], output: true, typedComponents: true, htmlCustomData: true, vueComponents: true }, ' : ''}${withWorker ? 'worker: { entry: ["index"] }' : ''} }, ${withWorker ? 'plugins: [{ name: "diagnostic-asset", generateBundle() { this.emitFile({ type: "asset", fileName: "stats0.html", source: "<title>Rollup Visualizer</title>" }) } }]' : ''} })`,
    ].join('\n'),
    'src/app.ts': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/index/index'], ...(withWorker ? { workers: 'workers' } : {}) }),
    'src/pages/index/index.ts': 'Page({})',
    'src/pages/index/index.json': JSON.stringify(autoImport ? {} : { usingComponents: { 'wevu-leaf': '/components/wevu-leaf/index' } }),
    'src/pages/index/index.wxml': '<view><wevu-leaf /></view>',
    'src/pages/index/index.wxss': '.page { color: red; }',
    'src/components/wevu-leaf/index.vue': [
      '<script setup lang="ts">',
      'defineProps<{ label: string }>()',
      'defineComponentJson({ options: { multipleSlots: true } })',
      '</script>',
      '<template><view><text>{{ label }}</text><slot /></view></template>',
    ].join('\n'),
    ...(withWorker ? { 'src/workers/index.ts': 'export default 1' } : {}),
  }
  for (const [relative, content] of Object.entries(files)) {
    const filename = path.join(root, relative)
    await fs.mkdir(path.dirname(filename), { recursive: true })
    await fs.writeFile(filename, content)
  }
  await fs.mkdir(path.join(root, 'node_modules'), { recursive: true })
  await fs.symlink(path.resolve(import.meta.dirname, '../../..'), path.join(root, 'node_modules/weapp-vite'), 'junction')
  await fs.symlink(path.resolve(import.meta.dirname, '../../../../../packages-runtime/wevu'), path.join(root, 'node_modules/wevu'), 'junction')
  return root
}

function readComponentJson(outputs: Array<OutputChunk | OutputAsset>) {
  const output = outputs.find(item => item.fileName === 'components/wevu-leaf/index.json')
  expect(output?.type).toBe('asset')
  return JSON.parse(String((output as OutputAsset).source)) as unknown
}

describe('stateful snapshot component metadata', () => {
  it('reuses only complete input versions and rejects an edit made while the snapshot is compiling', async () => {
    const root = await createProject()
    const options = { cwd: root, isDev: true, mode: 'development' }
    const initial = await buildStatefulHmrSnapshot(options)
    const candidate = await buildStatefulHmrSnapshot(options, undefined, undefined, undefined, initial.getInputFiles())
    expect(candidate.getInputs()).toBeDefined()
    expect(await validateSnapshotInputs(candidate.getInputs()!)).toBe(true)
    const style = path.join(root, 'src/pages/index/index.wxss')
    const changedDuringBuild = await buildStatefulHmrSnapshot(options, config => ({
      ...config,
      plugins: [...(config.plugins ?? []), {
        name: 'snapshot-edit-during-build',
        async generateBundle() {
          await fs.writeFile(style, '.page { color: blue; }')
        },
      }],
    }), undefined, undefined, candidate.getInputFiles())
    expect(changedDuringBuild.getInputs()).toBeUndefined()
    expect(await validateSnapshotInputs(candidate.getInputs()!)).toBe(false)
  })

  it('captures declared external inputs and refuses a newly discovered unversioned dependency', async () => {
    const root = await createProject()
    const options = { cwd: root, isDev: true, mode: 'development' }
    const first = path.join(root, 'external-one.txt')
    const second = path.join(root, 'external-two.txt')
    await fs.writeFile(first, 'first')
    await fs.writeFile(second, 'second')
    let external = first
    const configure = (config: InlineConfig): InlineConfig => ({
      ...config,
      plugins: [...(config.plugins ?? []), {
        name: 'snapshot-external-input',
        buildStart(this: { addWatchFile: (file: string) => void }) {
          this.addWatchFile(external)
        },
      }],
    })
    const initial = await buildStatefulHmrSnapshot(options, configure)
    expect(initial.getInputFiles()).toContain(first)
    external = second
    const unknown = await buildStatefulHmrSnapshot(options, configure, undefined, undefined, initial.getInputFiles())
    expect(unknown.getInputFiles()).toContain(second)
    expect(unknown.getInputs()).toBeUndefined()
    const known = await buildStatefulHmrSnapshot(options, configure, undefined, undefined, unknown.getInputFiles())
    expect(known.getInputs()).toBeDefined()
    await fs.writeFile(second, 'changed')
    expect(await validateSnapshotInputs(known.getInputs()!)).toBe(false)
  })

  it('builds from load options when an optional owner has no config service yet', async () => {
    const root = await createProject()
    const runtimeState = createRuntimeState()
    const source = path.join(root, 'src/components/wevu-leaf/index.vue')
    runtimeState.build.hmr.resolvedEntryMap.set(source, { id: source })
    const snapshot = await buildStatefulHmrSnapshot({ cwd: root, isDev: true, mode: 'development' }, undefined, { runtimeState })
    expect([...snapshot.getDelegatedComponentEntryIds()]).toContain((await fs.realpath(source)).replaceAll('\\', '/'))
    const outputs = Array.isArray(snapshot.output) ? snapshot.output.flatMap(item => item.output) : 'output' in snapshot.output ? snapshot.output.output : []
    expect(readComponentJson(outputs)).toEqual({ component: true, options: { multipleSlots: true } })
  })

  it('reloads app topology metadata between snapshots', async () => {
    const root = await createProject()
    const options = { cwd: root, isDev: true, mode: 'development' as const }
    const readApp = async () => {
      const snapshot = await buildStatefulHmrSnapshot(options)
      const outputs = Array.isArray(snapshot.output) ? snapshot.output.flatMap(item => item.output) : 'output' in snapshot.output ? snapshot.output.output : []
      const app = outputs.find(item => item.fileName === 'app.json') as OutputAsset
      return JSON.parse(String(app.source)) as { pages?: string[] }
    }

    expect(await readApp()).toMatchObject({ pages: ['pages/index/index'] })
    await fs.mkdir(path.join(root, 'src/pages/next'), { recursive: true })
    await fs.writeFile(path.join(root, 'src/pages/next/index.ts'), 'Page({})')
    await fs.writeFile(path.join(root, 'src/pages/next/index.json'), '{}')
    await fs.writeFile(path.join(root, 'src/pages/next/index.wxml'), '<view />')
    await fs.writeFile(path.join(root, 'src/app.json'), JSON.stringify({ pages: ['pages/index/index', 'pages/next/index'] }))

    expect(await readApp()).toMatchObject({ pages: ['pages/index/index', 'pages/next/index'] })
  })

  it('reuses the CLI dual config source across snapshots without evaluating either file again', async () => {
    const root = await createProject()
    const configFile = path.join(root, 'vite.config.ts')
    const extraConfigFile = path.join(root, 'weapp-vite.config.ts')
    await fs.writeFile(extraConfigFile, 'export default { define: { SNAPSHOT_CONFIG_MARKER: JSON.stringify("merged-source") } }')
    await fs.writeFile(path.join(root, 'src/app.ts'), 'App({ marker: SNAPSHOT_CONFIG_MARKER })')
    const owner = createCompilerContextInstance()
    const options = { cwd: root, isDev: true, mode: 'development' }
    await owner.configService.load(options)
    expect(owner.configService.options.configMergeInfo?.merged).toBe(true)
    // 资产刷新复用本轮配置；只有宿主配置重启才允许再次执行这两个文件。
    await fs.writeFile(configFile, 'throw new Error("vite config executed twice")')
    await fs.writeFile(extraConfigFile, 'throw new Error("weapp config executed twice")')
    try {
      for (const marker of ['first-template', 'second-template']) {
        await fs.writeFile(path.join(root, 'src/pages/index/index.wxml'), `<view>${marker}</view>`)
        const snapshot = await buildStatefulHmrSnapshot(options, undefined, owner)
        const outputs = Array.isArray(snapshot.output) ? snapshot.output.flatMap(item => item.output) : 'output' in snapshot.output ? snapshot.output.output : []
        expect((outputs.find(item => item.fileName === 'app.js') as OutputChunk).code).toContain('merged-source')
        expect(String((outputs.find(item => item.fileName === 'pages/index/index.wxml') as OutputAsset).source)).toContain(marker)
      }
    }
    finally {
      owner.moduleGraphService.resetSession()
    }
  })

  it.each([false, true])('preserves discovered native component assets with pinned sources (isDev=%s)', async (isDev) => {
    const root = await fs.realpath(await createProject())
    await fs.writeFile(path.join(root, 'project.private.config.json'), JSON.stringify({ setting: { compileHotReLoad: true } }))
    await fs.writeFile(path.join(root, 'vite.config.ts'), [
      `import { defineConfig } from ${JSON.stringify(path.resolve(import.meta.dirname, '../../config.ts'))}`,
      'export default defineConfig({ weapp: { srcRoot: "src", hmr: { runtime: "stateful-experimental" } } })',
    ].join('\n'))
    const files = {
      'src/pages/index/index.json': JSON.stringify({ component: true, usingComponents: { 'native-leaf': '../../components/native-leaf/index', 'wevu-leaf': '../../components/wevu-leaf/index' } }),
      'src/pages/index/index.wxml': '<native-leaf /><wevu-leaf />',
      'src/components/native-leaf/index.js': 'Component({ data: { marker: "PINNED" } })',
      'src/components/native-leaf/index.json': '{"component":true,"options":{"styleIsolation":"apply-shared"}}',
      'src/components/native-leaf/index.wxml': '<view>PINNED-TEMPLATE{{marker}}</view>',
      'src/components/native-leaf/index.wxss': '.native-leaf { width: 19px; }',
    }
    const sources = new Map<string, string>()
    for (const [relative, source] of Object.entries(files)) {
      const file = path.join(root, relative)
      await fs.mkdir(path.dirname(file), { recursive: true })
      await fs.writeFile(file, source.replaceAll('PINNED', 'FUTURE').replace('19px', '71px').replace('apply-shared', 'isolated'))
      sources.set(compilerSourceId(file), source)
    }
    const result = await buildStatefulHmrSnapshot({ cwd: root, isDev, mode: 'development' }, undefined, undefined, sources)
    const outputs = Array.isArray(result.output) ? result.output.flatMap(item => item.output) : 'output' in result.output ? result.output.output : []
    expect(outputs.map(item => item.fileName)).toEqual(expect.arrayContaining([
      'components/native-leaf/index.js',
      'components/native-leaf/index.json',
      'components/native-leaf/index.wxml',
      'components/native-leaf/index.wxss',
    ]))
    const script = outputs.find(item => item.fileName === 'components/native-leaf/index.js') as OutputChunk
    expect(script.code).toContain('PINNED')
    expect(script.code).not.toContain('FUTURE')
    const config = outputs.find(item => item.fileName === 'components/native-leaf/index.json') as OutputAsset
    expect(JSON.parse(String(config.source))).toMatchObject({ component: true, options: { styleIsolation: 'apply-shared' } })
    expect(outputs.find(item => item.fileName === 'components/native-leaf/index.wxml')).toMatchObject({
      type: 'asset',
      source: '<view>PINNED-TEMPLATE{{marker}}</view>',
    })
    const style = outputs.find(item => item.fileName === 'components/native-leaf/index.wxss') as OutputAsset
    expect(String(style.source)).toMatch(/width:\s*19px/)
    expect(String(style.source)).not.toContain('71px')
  })

  it('reports native component entry additions and removals from successive metadata snapshots', async () => {
    const root = await fs.realpath(await createProject())
    const pageJson = path.join(root, 'src/pages/index/index.json')
    const original = await fs.readFile(pageJson, 'utf8')
    const component = path.join(root, 'src/components/native-leaf/index.js')
    await fs.mkdir(path.dirname(component), { recursive: true })
    await fs.writeFile(component, 'Component({})')
    await fs.writeFile(component.replace('.js', '.json'), '{"component":true}')
    await fs.writeFile(component.replace('.js', '.wxml'), '<view>native leaf</view>')
    const options = { cwd: root, isDev: true, mode: 'development' }
    const owner = createCompilerContextInstance()
    await owner.configService.load(options)
    try {
      for (const enabled of [false, true, false]) {
        await fs.writeFile(pageJson, enabled
          ? JSON.stringify({ usingComponents: { 'native-leaf': '/components/native-leaf/index' } })
          : original)
        const result = await buildStatefulHmrSnapshot(options, undefined, owner)
        expect([...result.getEntryIds()].includes(component)).toBe(enabled)
      }
    }
    finally {
      owner.moduleGraphService.resetSession()
    }
  })

  it.each(['directory', 'junction'])('preserves native entry lifecycle while compiling fixed script, JSON, template and style inputs (%s root)', async (rootKind) => {
    let root = await createProject()
    if (rootKind === 'junction') {
      const aliasRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-snapshot-alias-'))
      temporaryRoots.push(aliasRoot)
      const alias = path.join(aliasRoot, 'project')
      await fs.symlink(root, alias, 'junction')
      root = alias
    }
    const inputs = new Map<string, string>([
      ['src/app.ts', 'App({})'],
      ['src/app.json', JSON.stringify({ pages: ['pages/index/index'], window: { navigationBarTitleText: 'PINNED-CONFIG' } })],
      ['src/pages/index/index.ts', 'Page({ data: { marker: "PINNED-SCRIPT" } })'],
      ['src/pages/index/index.wxml', '<view>PINNED-TEMPLATE<wevu-leaf /></view>'],
      ['src/pages/index/index.wxss', '.pinned { width: 19px; }'],
      ['src/layouts/default/index.ts', 'Component({})'],
      ['src/layouts/default/index.json', '{"component":true}'],
      ['src/layouts/default/index.wxml', '<view><slot /></view>'],
      ['src/layouts/default/index.wxss', '.layout { min-height: 100%; }'],
    ])
    const sources = new Map<string, string>()
    for (const [file, source] of inputs) {
      const absolute = path.join(root, file)
      await fs.mkdir(path.dirname(absolute), { recursive: true })
      sources.set(compilerSourceId(absolute), source)
      await fs.writeFile(absolute, source.replaceAll('PINNED', 'FUTURE').replace('19px', '71px'))
    }
    const result = await buildStatefulHmrSnapshot({ cwd: root, isDev: true, mode: 'development' }, undefined, undefined, sources)
    const outputs = Array.isArray(result.output) ? result.output.flatMap(item => item.output) : 'output' in result.output ? result.output.output : []
    const app = outputs.find(item => item.fileName === 'app.json') as OutputAsset
    expect(JSON.parse(String(app.source))).toMatchObject({ window: { navigationBarTitleText: 'PINNED-CONFIG' } })
    const script = outputs.find(item => item.fileName === 'pages/index/index.js') as OutputChunk
    expect(script.code).toContain('PINNED-SCRIPT')
    expect(script.code).not.toContain('FUTURE-SCRIPT')
    const template = outputs.find(item => item.fileName === 'pages/index/index.wxml') as OutputAsset
    expect(String(template.source)).toContain('PINNED-TEMPLATE')
    expect(String(template.source)).not.toContain('FUTURE-TEMPLATE')
    expect(String(template.source)).toContain('<weapp-layout-default')
    const pageConfig = outputs.find(item => item.fileName === 'pages/index/index.json') as OutputAsset
    expect(JSON.parse(String(pageConfig.source))).toMatchObject({ usingComponents: { 'weapp-layout-default': '/layouts/default/index' } })
    const style = outputs.find(item => item.fileName === 'pages/index/index.wxss') as OutputAsset
    expect(String(style.source)).toContain('19px')
    expect(String(style.source)).not.toContain('71px')
    expect(String(style.source).match(/width:\s*19px/g)).toHaveLength(1)
  })

  it('compiles the pinned SFC instead of a newer disk save', async () => {
    const root = await createProject()
    const file = path.join(root, 'src/components/wevu-leaf/index.vue')
    const original = await fs.readFile(file, 'utf8')
    const pinned = `${original.replace('<view>', '<view>PINNED-BATCH').replace('<script setup lang="ts">', '<script setup lang="ts">\nimport "./message"\nimport "./empty"\nimport "./untouched"')}\n<style src="./pinned.css" />`
    const style = path.join(root, 'src/components/wevu-leaf/pinned.css')
    const message = path.join(root, 'src/components/wevu-leaf/message.ts')
    const empty = path.join(root, 'src/components/wevu-leaf/empty.ts')
    await fs.writeFile(message, 'console.log("FUTURE-MODULE")')
    await fs.writeFile(empty, 'console.log("FUTURE-EMPTY")')
    await fs.writeFile(path.join(root, 'src/components/wevu-leaf/untouched.ts'), 'console.log("LIVE-UNPINNED")')
    await fs.writeFile(style, '.frozen { width: 71px; }')
    await fs.writeFile(file, original.replace('<view>', '<view>FUTURE-BATCH'))
    const sources = new Map([
      [compilerSourceId(file), pinned],
      [compilerSourceId(style), '.frozen { width: 19px; }'],
      [compilerSourceId(message), 'console.log("PINNED-MODULE")'],
      [compilerSourceId(empty), ''],
    ])
    const options = { cwd: root, isDev: true, mode: 'development' }
    const result = await buildStatefulHmrSnapshot(options, undefined, undefined, sources)
    const outputs = Array.isArray(result.output) ? result.output.flatMap(item => item.output) : 'output' in result.output ? result.output.output : []
    const template = outputs.find(item => item.fileName === 'components/wevu-leaf/index.wxml') as OutputAsset
    expect(String(template.source)).toContain('PINNED-BATCH')
    expect(String(template.source)).not.toContain('FUTURE-BATCH')
    const stylesheet = outputs.find(item => item.fileName === 'components/wevu-leaf/index.wxss') as OutputAsset
    expect(String(stylesheet.source)).toMatch(/width:\s*19px/)
    expect(String(stylesheet.source)).not.toContain('71px')
    const script = outputs.flatMap(item => item.type === 'chunk' ? [item.code] : []).join('\n')
    expect(script).toContain('PINNED-MODULE')
    expect(script).toContain('LIVE-UNPINNED')
    expect(script).not.toContain('FUTURE-MODULE')
    expect(script).not.toContain('FUTURE-EMPTY')
    await expect(buildStatefulHmrSnapshot(options, undefined, undefined, new Map<string, string | null>([
      ...sources,
      [compilerSourceId(message), null],
    ]))).rejects.toThrow('Source removed from snapshot:')
  })

  afterEach(async () => {
    await Promise.all(temporaryRoots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
  })

  it('includes current public bytes in unwritten snapshots while preserving compiled output precedence', async () => {
    const root = await createProject()
    const publicDir = path.join(root, 'public')
    await fs.mkdir(publicDir)
    await fs.writeFile(path.join(publicDir, 'extra.data'), 'first public bytes')
    await fs.writeFile(path.join(publicDir, '.visible'), 'dot file')
    await fs.writeFile(path.join(publicDir, 'app.js'), 'public must not replace App')
    const readSnapshot = async () => {
      const result = await buildStatefulHmrSnapshot({ cwd: root, isDev: true, mode: 'development' })
      return Array.isArray(result.output) ? result.output.flatMap(item => item.output) : 'output' in result.output ? result.output.output : []
    }
    const first = await readSnapshot()
    const publicOutput = (output: Array<OutputAsset | OutputChunk>, name: string) => {
      const file = output.find(item => item.fileName === name)
      return file?.type === 'asset' ? Buffer.from(file.source).toString('utf8') : undefined
    }
    expect(publicOutput(first, 'extra.data')).toBe('first public bytes')
    expect(publicOutput(first, '.visible')).toBe('dot file')
    expect(first.find(item => item.fileName === 'app.js')?.type).toBe('chunk')
    await fs.writeFile(path.join(publicDir, 'extra.data'), 'next public bytes')
    expect(publicOutput(await readSnapshot(), 'extra.data')).toBe('next public bytes')
    await fs.rm(path.join(publicDir, 'extra.data'))
    expect(publicOutput(await readSnapshot(), 'extra.data')).toBeUndefined()
    await expect(fs.stat(path.join(root, 'dist/extra.data'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('does not replay worker diagnostic assets into the main snapshot', async () => {
    const root = await createProject(false, true)
    const snapshot = await buildStatefulHmrSnapshot({ cwd: root, isDev: true, mode: 'development' })
    const outputs = Array.isArray(snapshot.output) ? snapshot.output.flatMap(item => item.output) : 'output' in snapshot.output ? snapshot.output.output : []
    expect(outputs.filter(item => item.fileName === 'stats0.html')).toHaveLength(1)
  })

  it.each(['publicDir', 'copyPublicDir'] as const)('keeps disabled %s public assets out of snapshots', async (disabled) => {
    const root = await createProject()
    await fs.mkdir(path.join(root, 'public'))
    await fs.writeFile(path.join(root, 'public/ignored.data'), 'must not emit')
    const snapshot = await buildStatefulHmrSnapshot({ cwd: root, isDev: true, mode: 'development' }, config => ({
      ...config,
      ...(disabled === 'publicDir' ? { publicDir: false } : {}),
      build: { ...config.build, ...(disabled === 'copyPublicDir' ? { copyPublicDir: false } : {}) },
    }))
    const outputs = Array.isArray(snapshot.output) ? snapshot.output.flatMap(item => item.output) : 'output' in snapshot.output ? snapshot.output.output : []
    expect(outputs.some(item => item.fileName === 'ignored.data')).toBe(false)
  })

  it('retains native page style metadata after asset-only snapshots discard script chunks', async () => {
    const root = await createProject()
    const snapshot = await buildStatefulHmrSnapshot({ cwd: root, isDev: true, mode: 'development' }, config => ({
      ...config,
      plugins: [...(config.plugins ?? []), {
        name: 'snapshot-assets-only',
        enforce: 'post',
        generateBundle(_options, bundle) {
          for (const [file, item] of Object.entries(bundle)) {
            if (item.type === 'chunk') {
              delete bundle[file]
            }
          }
        },
      }],
    }))
    const outputs = Array.isArray(snapshot.output) ? snapshot.output.flatMap(item => item.output) : 'output' in snapshot.output ? snapshot.output.output : []
    expect(outputs.some(item => item.type === 'chunk')).toBe(false)
    expect(snapshot.getGlobalStyleRoutes()).toEqual(['pages/index/index'])
  })

  it('publishes current asset findings after Glass configuration and source template fixes', async () => {
    const root = await createProject()
    const options = { cwd: root, isDev: true, mode: 'development' }
    const buildSnapshot = () => buildStatefulHmrSnapshot(options, config => ({
      ...config,
      plugins: [...(config.plugins ?? []), {
        name: 'snapshot-assets-only',
        enforce: 'post',
        generateBundle(_options, bundle) {
          for (const [file, item] of Object.entries(bundle)) {
            if (item.type === 'chunk') {
              delete bundle[file]
            }
          }
        },
      }],
    }))
    const consumer = createCompilerContextInstance()
    const consumeFacts = async () => {
      const snapshot = await buildSnapshot()
      const currentFacts = consumer.runtimeState.glassEasel.analysisByOwner
      currentFacts.clear()
      for (const [owner, fact] of snapshot.getGlassEaselAnalysisByOwner()) {
        currentFacts.set(owner, fact)
      }
      return createGlassEaselAnalyzeResult(consumer)
    }

    await fs.writeFile(path.join(root, 'src/app.json'), JSON.stringify({
      pages: ['pages/index/index'],
      glassEaselWebview: true,
    }))
    await fs.writeFile(
      path.join(root, 'src/pages/index/index.wxml'),
      '<view wx-if="{{ready}}"><wevu-leaf /></view>',
    )
    expect((await consumeFacts()).diagnostics.map(item => item.code).sort()).toEqual(['GE001', 'GE002'])

    await fs.writeFile(path.join(root, 'src/app.json'), JSON.stringify({
      pages: ['pages/index/index'],
      componentFramework: 'glass-easel',
      glassEaselWebview: true,
    }))
    expect((await consumeFacts()).diagnostics.map(item => item.code)).toEqual(['GE002'])
    await fs.writeFile(path.join(root, 'src/pages/index/index.wxml'), '<view wx:if="{{ready}}"><wevu-leaf /></view>')
    expect(await consumeFacts()).toMatchObject({
      detected: true,
      diagnostics: [],
      summary: { errors: 0, warnings: 0 },
    })
  })

  it('leaves support files with their active owner across successful and failed snapshots', async () => {
    const root = await createProject(true)
    const options = { cwd: root, isDev: true, mode: 'development' }
    const active = createCompilerContextInstance()
    active.currentBuildTarget = 'app'
    await active.configService.load(options)
    await syncProjectSupportFiles(active)
    const activeOwner = path.join(root, 'src/pages/active.ts')
    const activeDependency = path.join(root, 'src/active-dependency.ts')
    const activeLogical = createLogicalEntryId(activeOwner, 'page')
    const activeScope = {}
    active.moduleGraphService.bindBuildContext(activeScope, {
      getModuleIds: () => [activeDependency, activeLogical],
      getModuleInfo: id => id === activeDependency ? { importers: [activeLogical] } : {},
    })
    active.moduleGraphService.bindPluginContext(activeScope, {
      resolve: async () => ({ id: activeDependency }),
      load: async () => ({ exports: ['active'] }),
    })
    active.moduleGraphService.replaceEntryDependencies(activeOwner, 'template', [path.join(root, 'src/active.wxml')])
    const supportFiles = ['auto-import-components.json', 'typed-components.d.ts', 'components.d.ts', 'mini-program.html-data.json']
    const before = new Map<string, string>()
    for (const name of supportFiles) {
      const filename = path.join(root, '.weapp-vite', name)
      before.set(name, await fs.readFile(filename, 'utf8'))
      await fs.utimes(filename, 1, 1)
    }

    for (const fail of [false, true]) {
      if (fail) {
        await expect(buildStatefulHmrSnapshot(options, config => ({
          ...config,
          plugins: [...(config.plugins ?? []), {
            name: 'snapshot-test-failure',
            generateBundle() {
              throw new Error('intentional snapshot failure')
            },
          }],
        }))).rejects.toThrow('intentional snapshot failure')
      }
      else {
        const { output: result } = await buildStatefulHmrSnapshot(options)
        const outputs = Array.isArray(result) ? result.flatMap(item => item.output) : 'output' in result ? result.output : []
        expect(readComponentJson(outputs)).toEqual({ component: true, options: { multipleSlots: true } })
        const pageTemplate = outputs.find(item => item.fileName === 'pages/index/index.wxml') as OutputAsset
        expect(String(pageTemplate.source)).toContain('<wevu-leaf')
        const pageJson = outputs.find(item => item.fileName === 'pages/index/index.json') as OutputAsset
        expect(JSON.parse(String(pageJson.source))).toMatchObject({ usingComponents: { 'wevu-leaf': '/components/wevu-leaf/index' } })
      }
      for (const name of supportFiles) {
        const filename = path.join(root, '.weapp-vite', name)
        expect(await fs.readFile(filename, 'utf8'), name).toBe(before.get(name))
        expect((await fs.stat(filename)).mtimeMs, `${name} was rewritten`).toBe(1000)
      }
      expect(active.moduleGraphService.hasModule(activeDependency)).toBe(true)
      expect(active.moduleGraphService.collectAffectedEntries(activeDependency)).toEqual(new Set([activeOwner]))
      expect(active.moduleGraphService.collectAffectedEntries(path.join(root, 'src/active.wxml'))).toEqual(new Set([activeOwner]))
      await expect(active.moduleGraphService.resolve('active')).resolves.toEqual({ id: activeDependency })
      await expect(active.moduleGraphService.load({ id: activeDependency })).resolves.toEqual({ exports: ['active'] })
    }

    active.autoImportService.setSupportFileResolverComponents({ 'late-leaf': 'fixture-components/late-leaf' })
    await active.autoImportService.awaitManifestWrites()
    expect(await fs.readFile(path.join(root, '.weapp-vite/auto-import-components.json'), 'utf8')).toContain('late-leaf')
    expect(await fs.readFile(path.join(root, '.weapp-vite/components.d.ts'), 'utf8')).toContain('LateLeaf')
  })

  it('retains the component declaration across fresh snapshot builds after a page style edit', async () => {
    const root = await createProject()
    const options = { cwd: root, isDev: true, mode: 'development' }
    for (const color of ['red', 'blue']) {
      await fs.writeFile(path.join(root, 'src/pages/index/index.wxss'), `.page { color: ${color}; }`)
      const snapshot = await buildStatefulHmrSnapshot(options, config => ({
        ...config,
        plugins: [...(config.plugins ?? []), {
          name: 'snapshot-assets-only',
          enforce: 'post',
          generateBundle(_options, bundle) {
            for (const [name, output] of Object.entries(bundle)) {
              if (output.type === 'chunk') {
                delete bundle[name]
              }
            }
          },
        }],
      }))
      const result = snapshot.output
      expect(snapshot.getDelegatedComponentEntryIds()).toEqual([
        (await fs.realpath(path.join(root, 'src/components/wevu-leaf/index.vue'))).replaceAll('\\', '/'),
      ])
      const outputs = Array.isArray(result) ? result.flatMap(item => item.output) : 'output' in result ? result.output : []
      expect(readComponentJson(outputs), color).toEqual({ component: true, options: { multipleSlots: true } })
    }
  })

  it('retains component metadata after resetting the active build context for a full restart', async () => {
    const root = await createProject()
    const ctx = createCompilerContextInstance()
    ctx.currentBuildTarget = 'app'
    const loadOptions = { cwd: root, isDev: true, mode: 'development' }
    for (let iteration = 0; iteration < 2; iteration++) {
      resetRuntimeStateForFreshBuild(ctx.runtimeState)
      ctx.moduleGraphService.resetSession()
      await ctx.configService.load(loadOptions)
      await ctx.scanService.loadAppEntry()
      ctx.scanService.loadSubPackages()
      const options = ctx.configService.merge(undefined, createSharedBuildConfig(ctx.configService, ctx.scanService))
      options.build = { ...options.build, watch: undefined, write: false }
      const result = await build(options)
      const outputs = Array.isArray(result) ? result.flatMap(item => item.output) : 'output' in result ? result.output : []
      expect(readComponentJson(outputs), `restart ${iteration}`).toEqual({ component: true, options: { multipleSlots: true } })
    }
  })
})
