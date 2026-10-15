import type { LogicalEntryDependency } from '../../../moduleGraph/logicalEntry'
import type { Entry } from '../../../types'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogicalEntryId, createSidecarModuleId } from '../../../moduleGraph/protocol'
import { createLogicalEntryLoadHook } from './logicalEntry'

const discovery = vi.hoisted(() => ({
  json: vi.fn(),
  template: vi.fn(),
  style: vi.fn(),
  exists: vi.fn(async (_candidate: string) => true),
}))

vi.mock('../../../utils', () => ({
  findCssEntry: discovery.style,
  findJsEntry: vi.fn(async () => ({ path: undefined })),
  findJsonEntry: discovery.json,
  findTemplateEntry: discovery.template,
  findVueEntry: vi.fn(async () => undefined),
  isTemplate: (id: string) => id.endsWith('.wxml'),
}))
vi.mock('../../utils/cache', () => ({ pathExists: discovery.exists }))

const roots: string[] = []

beforeEach(() => {
  vi.clearAllMocks()
  discovery.exists.mockResolvedValue(true)
})

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'logical-layout-owner-')))
  roots.push(root)
  const src = path.join(root, 'src')
  const source = path.join(src, 'layouts/default/index.ts')
  const json = path.join(src, 'layouts/default/index.json')
  const template = path.join(src, 'layouts/default/index.wxml')
  const component = path.join(src, 'components/layout-card.ts')
  discovery.json.mockResolvedValue({ path: json })
  discovery.template.mockResolvedValue({ path: template })
  discovery.style.mockResolvedValue({ path: undefined })
  const entriesMap = new Map<string, Entry>()
  const readJson = vi.fn(async () => ({ component: true, usingComponents: { card: '/components/layout-card.ts' } }))
  const pending: LogicalEntryDependency[] = []
  const state = {
    entriesMap,
    resolvedEntryMap: new Map(),
    loadEntry: vi.fn(),
    ctx: {
      configService: { isDev: false, absoluteSrcRoot: src, relativeAbsoluteSrcRoot: (id: string) => path.relative(src, id) },
      moduleGraphService: { bindPluginContext: vi.fn(), getEntryDependencies: () => pending, replaceEntryDependencies: vi.fn() },
      jsonService: { read: readJson },
      runtimeState: {
        build: { hmr: { externalComponentEntryMap: new Map(), vueEntryStyleBindings: new Map() } },
        css: { importerToDependencies: new Map() },
      },
      wxmlService: { scan: vi.fn(), depsMap: new Map() },
    },
  }
  const plugin = { addWatchFile: vi.fn(), resolve: vi.fn(async (id: string) => ({ id })) }
  const load = (owner = source) => createLogicalEntryLoadHook(state as any).call(plugin as any, createLogicalEntryId(owner, 'layout'))
  const parents = ['first', 'second'].map(name => ({
    source: path.join(src, `pages/${name}/index.ts`),
    json: path.join(src, `pages/${name}/index.json`),
    template: path.join(src, `pages/${name}/index.wxml`),
    component: path.join(src, `components/${name}.ts`),
  }))
  // 子入口尚未读取自身配置时，入口发现表可能暂存父入口的解析上下文。
  const register = (parent: typeof parents[number]) => {
    if (entriesMap.get('layouts/default/index')?.declaredJson !== undefined) {
      return
    }
    entriesMap.set('layouts/default/index', {
      type: 'component',
      path: parent.source,
      jsonPath: parent.json,
      templatePath: parent.template,
      json: { usingComponents: { parent: `/${path.relative(src, parent.component)}` } },
    } as Entry)
  }
  return { root, src, source, json, template, component, entriesMap, readJson, state, load, parents, register, pending }
}

describe('logical native layout metadata ownership', () => {
  it.each(['forward', 'reverse', 'concurrent-forward', 'concurrent-reverse'])('uses layout sidecars after %s parent discovery', async (order) => {
    const setup = await fixture()
    const parents = order.endsWith('reverse') ? setup.parents.toReversed() : setup.parents
    if (order.startsWith('concurrent')) {
      await Promise.all(parents.map(parent => Promise.resolve().then(() => setup.register(parent))))
    }
    else {
      parents.forEach(setup.register)
    }
    const result = await setup.load()
    expect(result?.code).toContain(JSON.stringify(createSidecarModuleId(setup.source, setup.json, 'json')))
    expect(result?.code).toContain(JSON.stringify(createSidecarModuleId(setup.source, setup.template, 'template')))
    expect(result?.code).toContain(JSON.stringify(createSidecarModuleId(setup.source, setup.component, 'using-component')))
    for (const parent of parents) {
      for (const dependency of [parent.source, parent.json, parent.template, parent.component]) {
        expect(result?.code).not.toContain(encodeURIComponent(dependency))
      }
    }
    expect(setup.readJson).toHaveBeenCalledExactlyOnceWith(setup.json)
  })

  it('does not borrow parent metadata when the layout has no physical sidecars', async () => {
    const setup = await fixture()
    setup.parents.forEach(setup.register)
    discovery.json.mockResolvedValue({ path: undefined })
    discovery.template.mockResolvedValue({ path: undefined })
    const result = await setup.load()
    for (const parent of setup.parents) {
      for (const dependency of [parent.json, parent.template, parent.component]) {
        expect(result?.code).not.toContain(encodeURIComponent(dependency))
      }
    }
    expect(result?.code).toContain(`import ${JSON.stringify(setup.source)};`)
    expect(setup.readJson).not.toHaveBeenCalled()
  })

  it('preserves completed layout metadata when later parents register the same layout', async () => {
    const setup = await fixture()
    const ownJson = path.join(setup.src, 'generated/layout-config.json')
    const ownTemplate = path.join(setup.src, 'generated/layout-template.wxml')
    const ownComponent = path.join(setup.src, 'components/declared-card.ts')
    const discoveredComponent = path.join(setup.src, 'components/auto-card.ts')
    setup.entriesMap.set('layouts/default/index', {
      type: 'component',
      path: setup.source,
      jsonPath: ownJson,
      templatePath: ownTemplate,
      declaredJson: { usingComponents: { declared: '/components/declared-card.ts' } },
      json: { usingComponents: { declared: '/components/declared-card.ts', auto: '/components/auto-card.ts' } },
    } as Entry)
    setup.parents.toReversed().forEach(setup.register)
    const result = await setup.load()
    expect(result?.code).toContain(JSON.stringify(createSidecarModuleId(setup.source, ownJson, 'json')))
    expect(result?.code).toContain(JSON.stringify(createSidecarModuleId(setup.source, ownTemplate, 'template')))
    expect(result?.code).toContain(JSON.stringify(createSidecarModuleId(setup.source, ownComponent, 'using-component')))
    expect(result?.code).not.toContain(encodeURIComponent(discoveredComponent))
    expect(setup.readJson).not.toHaveBeenCalled()
  })

  it('rejects metadata belonging to the previous physical source after entry handoff', async () => {
    const setup = await fixture()
    const oldSource = setup.source.replace(/\.ts$/, '.js')
    const oldComponent = path.join(setup.src, 'components/previous.ts')
    setup.entriesMap.set('layouts/default/index', {
      type: 'component',
      path: oldSource,
      jsonPath: setup.parents[0]!.json,
      templatePath: setup.parents[0]!.template,
      declaredJson: { usingComponents: { old: '/components/previous.ts' } },
      json: {},
    } as Entry)
    const result = await setup.load()
    expect(result?.code).toContain(JSON.stringify(createSidecarModuleId(setup.source, setup.json, 'json')))
    expect(result?.code).not.toContain(encodeURIComponent(oldComponent))
    expect(result?.code).not.toContain(encodeURIComponent(setup.parents[0]!.json))
  })

  it.each(['parent', 'previous-source'])('does not resurrect %s sidecars retained in the pending graph', async (origin) => {
    const setup = await fixture()
    const previousSource = origin === 'parent' ? setup.parents[0]!.source : setup.source.replace(/\.ts$/, '.js')
    setup.entriesMap.set('layouts/default/index', {
      type: 'component',
      path: previousSource,
      jsonPath: setup.parents[0]!.json,
      templatePath: setup.parents[0]!.template,
    } as Entry)
    const stale = [
      { kind: 'script', sourceId: previousSource },
      { kind: 'template', sourceId: setup.parents[0]!.template },
      { kind: 'style', sourceId: path.join(setup.src, 'previous-layout.wxss') },
      { kind: 'wxs', sourceId: path.join(setup.src, 'previous-layout.wxs') },
      { kind: 'layout', sourceId: path.join(setup.src, 'layouts/previous.vue') },
    ] satisfies LogicalEntryDependency[]
    setup.pending.push(...stale)
    const result = await setup.load()
    for (const dependency of stale) {
      expect(result?.code).not.toContain(JSON.stringify(createSidecarModuleId(setup.source, dependency.sourceId, dependency.kind)))
    }
  })

  it('keeps only the reachable template and WXS closure across repeated loads', async () => {
    const setup = await fixture()
    const included = path.join(setup.src, 'shared/included.wxml')
    const nested = path.join(setup.src, 'shared/nested.wxml')
    const script = path.join(setup.src, 'shared/filter.wxs')
    const graph = setup.state.ctx.wxmlService.depsMap
    graph.set(setup.template, new Set([included]))
    graph.set(included, new Set([nested, script]))
    graph.set(nested, new Set([setup.template]))
    setup.pending.push({ kind: 'template', sourceId: setup.parents[0]!.template })
    const first = await setup.load()
    for (const [kind, file] of [['template', included], ['template', nested], ['wxs', script]] as const) {
      expect(first?.code).toContain(JSON.stringify(createSidecarModuleId(setup.source, file, kind)))
    }
    expect(first?.code).not.toContain(encodeURIComponent(setup.parents[0]!.template))
    setup.pending.push({ kind: 'template', sourceId: included }, { kind: 'template', sourceId: nested }, { kind: 'wxs', sourceId: script })
    setup.state.ctx.wxmlService.scan.mockImplementationOnce(() => {
      graph.set(setup.template, new Set())
    })
    const repeated = await setup.load()
    for (const file of [included, nested, script]) {
      expect(repeated?.code).not.toContain(encodeURIComponent(file))
    }
    expect(setup.state.ctx.wxmlService.scan).toHaveBeenCalledTimes(2)
  })

  it.each(['vue', 'generated'])('preserves %s style dependencies proven by the current source owner', async (kind) => {
    const setup = await fixture()
    const source = kind === 'vue' ? setup.source.replace(/\.ts$/, '.vue') : '\0generated-layout/default.ts'
    const key = kind === 'vue' ? 'layouts/default/index' : source.replace(/\.ts$/, '')
    setup.entriesMap.set(key, { type: 'component', path: source, declaredJson: {} } as Entry)
    const ownStyle = path.join(setup.src, 'shared/layout.scss')
    const ownExternalSource = path.join(setup.src, 'shared/layout-script.ts')
    const parentStyle = path.join(setup.src, 'pages/first/index.wxss')
    setup.state.ctx.runtimeState.css.importerToDependencies.set(source, new Set([ownStyle]))
    setup.state.ctx.runtimeState.css.importerToDependencies.set(setup.parents[0]!.source, new Set([parentStyle]))
    setup.state.ctx.runtimeState.build.hmr.vueEntryStyleBindings.set(source, { sources: [ownExternalSource] })
    for (const file of [ownStyle, ownExternalSource, parentStyle]) {
      setup.pending.push({ kind: 'style', sourceId: file })
    }
    const result = await setup.load(source)
    for (const file of [ownStyle, ownExternalSource]) {
      expect(result?.code).toContain(JSON.stringify(createSidecarModuleId(source, file, 'style')))
    }
    expect(result?.code).not.toContain(encodeURIComponent(parentStyle))
  })

  it('reads component declarations from the same effective custom JSON path it emits', async () => {
    const setup = await fixture()
    const customJson = path.join(setup.src, 'generated/layout.json')
    setup.entriesMap.set('layouts/default/index', { type: 'component', path: setup.source, jsonPath: customJson } as Entry)
    setup.readJson.mockResolvedValue({ component: true, usingComponents: { card: '/components/custom-card.ts' } })
    const result = await setup.load()
    expect(setup.readJson).toHaveBeenCalledExactlyOnceWith(customJson)
    expect(result?.code).toContain(JSON.stringify(createSidecarModuleId(setup.source, customJson, 'json')))
    expect(result?.code).toContain(JSON.stringify(createSidecarModuleId(setup.source, path.join(setup.src, 'components/custom-card.ts'), 'using-component')))
  })

  it('does not read a missing custom JSON sidecar after it is removed', async () => {
    const setup = await fixture()
    const customJson = path.join(setup.src, 'generated/removed.json')
    setup.entriesMap.set('layouts/default/index', { type: 'component', path: setup.source, jsonPath: customJson } as Entry)
    discovery.exists.mockImplementation(async candidate => candidate !== customJson)
    const result = await setup.load()
    expect(result?.code).not.toContain(encodeURIComponent(customJson))
    expect(setup.readJson).not.toHaveBeenCalled()
  })

  it('accepts metadata owned through a relative source declaration', async () => {
    const setup = await fixture()
    setup.entriesMap.set('layouts/default/index', {
      type: 'component',
      path: 'layouts/default/index.ts',
      declaredJson: {},
      json: {},
      jsonPath: setup.json,
      templatePath: setup.template,
    } as Entry)
    await setup.load()
    expect(setup.readJson).not.toHaveBeenCalled()
  })

  it('accepts a physical source alias without borrowing metadata from a different file', async () => {
    const setup = await fixture()
    await mkdir(path.dirname(setup.source), { recursive: true })
    await writeFile(setup.source, 'Component({})')
    const alias = path.join(setup.root, 'layout-alias.ts')
    await symlink(setup.source, alias)
    setup.entriesMap.set('layouts/default/index', {
      type: 'component',
      path: alias,
      declaredJson: { usingComponents: { card: '/components/alias-card.ts' } },
      json: {},
      jsonPath: setup.json,
      templatePath: setup.template,
    } as Entry)
    const result = await setup.load()
    expect(result?.code).toContain(JSON.stringify(createSidecarModuleId(setup.source, path.join(setup.src, 'components/alias-card.ts'), 'using-component')))
    expect(setup.readJson).not.toHaveBeenCalled()
  })

  it('keeps layout JSON read errors instead of substituting a parent declaration', async () => {
    const setup = await fixture()
    setup.parents.forEach(setup.register)
    setup.readJson.mockRejectedValue(new Error('invalid layout configuration'))
    await expect(setup.load()).rejects.toThrow('invalid layout configuration')
  })

  it('keeps compiler-owned metadata when a generated layout source is not on disk', async () => {
    const setup = await fixture()
    const generated = '\0generated-layout/default.ts'
    const ownComponent = path.join(setup.src, 'components/generated-card.ts')
    setup.entriesMap.set(generated.replace(/\.ts$/, ''), {
      type: 'component',
      path: generated,
      declaredJson: { usingComponents: { card: '/components/generated-card.ts' } },
      json: {},
      jsonPath: setup.json,
      templatePath: setup.template,
    } as Entry)
    discovery.json.mockResolvedValue({ path: undefined })
    discovery.template.mockResolvedValue({ path: undefined })
    const result = await setup.load(generated)
    expect(result?.code).toContain(JSON.stringify(createSidecarModuleId(generated, ownComponent, 'using-component')))
    expect(setup.readJson).not.toHaveBeenCalled()
  })
})
