import type { PluginContext } from 'rolldown'
import type { SidecarModuleKind } from '../../../moduleGraph/protocol'
import type { Entry } from '../../../types'
import type { ExtendedLibManager } from '../../hooks/useLoadEntry/extendedLib'
import type { CorePluginState } from '../helpers'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import { createLogicalEntryId, createSidecarModuleId } from '../../../moduleGraph/protocol'
import { prepareNormalizedEntries } from '../../hooks/useLoadEntry/loadEntry/emit'
import { createLogicalEntryLoadHook } from './logicalEntry'

const mocks = vi.hoisted(() => ({
  findCssEntry: vi.fn(),
  findJsonEntry: vi.fn(),
  findTemplateEntry: vi.fn(),
  pathExists: vi.fn(),
}))

vi.mock('../../../utils', async importOriginal => ({
  ...await importOriginal<typeof import('../../../utils')>(),
  findCssEntry: mocks.findCssEntry,
  findJsonEntry: mocks.findJsonEntry,
  findTemplateEntry: mocks.findTemplateEntry,
}))

vi.mock('../../utils/cache', async importOriginal => ({
  ...await importOriginal<typeof import('../../utils/cache')>(),
  pathExists: mocks.pathExists,
}))

function createFixture(options: { loaded?: boolean, hasSidecars?: boolean, ownComponents?: boolean } = {}) {
  const root = path.join(tmpdir(), 'weapp-logical-entry-ownership-fixture', 'src')
  const childKey = 'layouts/shared/index'
  const childId = path.join(root, `${childKey}.ts`)
  const childJson = path.join(root, `${childKey}.json`)
  const childTemplate = path.join(root, `${childKey}.wxml`)
  const childStyle = path.join(root, `${childKey}.wxss`)
  const parentIds = {
    home: path.join(root, 'pages/home/index.ts'),
    details: path.join(root, 'pages/details/index.ts'),
  }
  const parentCard = path.join(root, 'components/parent-card/index.ts')
  const childCard = path.join(root, 'components/child-card/index.ts')
  const genericCard = path.join(root, 'components/generic-card/index.ts')
  const childDeclaration = {
    component: true,
    ...options.ownComponents
      ? {
          usingComponents: { card: '/components/child-card/index' },
          componentGenerics: { content: { default: '/components/generic-card/index' } },
        }
      : {},
  }
  const hasSidecars = options.hasSidecars ?? true
  const existingFiles = new Set([
    childId,
    parentCard,
    childCard,
    genericCard,
    ...Object.values(parentIds).flatMap(id => [id, id.replace(/\.ts$/, '.json'), id.replace(/\.ts$/, '.wxml')]),
    ...hasSidecars ? [childJson, childTemplate, childStyle] : [],
  ])
  mocks.pathExists.mockImplementation(async (id: string) => existingFiles.has(id))
  for (const [finder, file] of [
    [mocks.findJsonEntry, childJson],
    [mocks.findTemplateEntry, childTemplate],
    [mocks.findCssEntry, childStyle],
  ] as const) {
    finder.mockImplementation(async (id: string) => ({
      path: id === childId && hasSidecars ? file : undefined,
      predictions: [],
    }))
  }

  const entriesMap = new Map<string, Entry | undefined>()
  const childEntry: Entry = {
    type: 'component',
    path: childId,
    jsonPath: childJson,
    templatePath: childTemplate,
    json: childDeclaration,
    declaredJson: childDeclaration,
  }
  if (options.loaded) {
    entriesMap.set(childKey, childEntry)
  }
  const dependencies = new Map<SidecarModuleKind, string[]>()
  const state = {
    entriesMap,
    resolvedEntryMap: new Map(),
    loadEntry: vi.fn(async () => undefined),
    ctx: {
      configService: {
        absoluteSrcRoot: root,
        isDev: false,
        platform: 'weapp',
        relativeAbsoluteSrcRoot: (id: string) => path.relative(root, id),
      },
      moduleGraphService: {
        bindPluginContext: vi.fn(),
        getEntryDependencies: () => [],
        replaceEntryDependencies: (_ownerId: string, kind: SidecarModuleKind, sources: Iterable<string>) => {
          const values = [...sources]
          if (values.length) {
            dependencies.set(kind, values)
          }
        },
      },
      runtimeState: { build: { hmr: { externalComponentEntryMap: new Map() } } },
      jsonService: { read: vi.fn(async () => childDeclaration) },
      wxmlService: { scan: vi.fn(async () => {}), depsMap: new Map() },
    },
  }
  const pluginContext = {
    addWatchFile: vi.fn(),
    resolve: vi.fn(async (id: string) => {
      const resolvedId = existingFiles.has(id) ? id : `${id}.ts`
      return existingFiles.has(resolvedId) ? { id: resolvedId } : null
    }),
  }

  function registerParent(name: keyof typeof parentIds) {
    const id = parentIds[name]
    prepareNormalizedEntries({
      entries: [`/${childKey}`],
      json: name === 'home' ? { usingComponents: { card: '/components/parent-card/index' } } : {},
      jsonPath: id.replace(/\.ts$/, '.json'),
      templatePath: id.replace(/\.ts$/, '.wxml'),
      id,
      entriesMap,
      normalizeEntry: entry => entry.replace(/^\/+/, ''),
      explicitEntryTypes: new Map([[childKey, 'component']]),
      extendedLibManager: { shouldIgnoreEntry: () => false } as unknown as ExtendedLibManager,
    })
  }

  async function loadChild() {
    const result = await createLogicalEntryLoadHook(state as unknown as CorePluginState)
      .call(pluginContext as unknown as PluginContext, createLogicalEntryId(childId, 'layout'))
    return result?.code ?? ''
  }

  const expectedDependencies = new Map<SidecarModuleKind, string[]>([['script', [childId]]])
  if (hasSidecars) {
    expectedDependencies.set('json', [childJson])
    expectedDependencies.set('template', [childTemplate])
    expectedDependencies.set('style', [childStyle])
  }
  if (options.ownComponents) {
    expectedDependencies.set('using-component', [childCard, genericCard])
  }
  return {
    childDeclaration,
    childEntry,
    childId,
    childJson,
    childKey,
    dependencies,
    entriesMap,
    expectedDependencies,
    loadChild,
    readDeclaration: state.ctx.jsonService.read,
    registerParent,
  }
}

describe('production logical entry sidecar ownership', () => {
  it.each([
    ['home', 'details'],
    ['details', 'home'],
  ] as const)('uses child sidecars when parents register %s then %s', async (first, second) => {
    const fixture = createFixture()
    fixture.registerParent(first)
    fixture.registerParent(second)

    const code = await fixture.loadChild()

    expect(fixture.dependencies).toEqual(fixture.expectedDependencies)
    for (const [kind, sources] of fixture.expectedDependencies) {
      for (const source of sources) {
        expect(code).toContain(JSON.stringify(createSidecarModuleId(fixture.childId, source, kind)))
      }
    }
  })

  it('preserves loaded child metadata when both parents declare it again', async () => {
    const fixture = createFixture({ loaded: true })
    fixture.registerParent('home')
    fixture.registerParent('details')

    await fixture.loadChild()

    expect(fixture.entriesMap.get(fixture.childKey)).toEqual(fixture.childEntry)
    expect(fixture.dependencies).toEqual(fixture.expectedDependencies)
  })

  it('does not inherit parent sidecars when the child has no sidecars', async () => {
    const fixture = createFixture({ hasSidecars: false })
    fixture.registerParent('details')
    fixture.registerParent('home')

    await fixture.loadChild()

    expect(fixture.dependencies).toEqual(fixture.expectedDependencies)
  })

  it('keeps child component declarations and identical wrappers across opposite parent orders', async () => {
    const wrappers: string[] = []
    for (const order of [['home', 'details'], ['details', 'home']] as const) {
      const fixture = createFixture({ ownComponents: true })
      for (const parent of order) {
        fixture.registerParent(parent)
      }

      wrappers.push(await fixture.loadChild())

      expect(fixture.readDeclaration).toHaveBeenCalledExactlyOnceWith(fixture.childJson)
      expect(fixture.dependencies).toEqual(fixture.expectedDependencies)
    }
    expect(wrappers[0]).toBe(wrappers[1])
  })

  it.each(['find', 'read'] as const)('keeps the wrapper stable when child metadata publishes during async %s', async (stage) => {
    const fixture = createFixture({ ownComponents: true })
    fixture.registerParent('home')
    const entered = Promise.withResolvers<void>()
    const resume = Promise.withResolvers<void>()
    const waitForPublication = async () => {
      entered.resolve()
      await resume.promise
    }
    if (stage === 'find') {
      mocks.findJsonEntry.mockImplementationOnce(async () => {
        await waitForPublication()
        return { path: fixture.childJson, predictions: [] }
      })
    }
    else {
      fixture.readDeclaration.mockImplementationOnce(async () => {
        await waitForPublication()
        return fixture.childDeclaration
      })
    }
    const loading = fixture.loadChild()
    await entered.promise
    fixture.entriesMap.set(fixture.childKey, fixture.childEntry)
    resume.resolve()

    const duringPublication = await loading
    const afterPublication = await fixture.loadChild()

    expect(duringPublication).toBe(afterPublication)
    expect(fixture.dependencies).toEqual(fixture.expectedDependencies)
  })

  it('finds an owned absolute-key record behind a relative-key parent placeholder', async () => {
    const fixture = createFixture({ ownComponents: true })
    fixture.registerParent('home')
    fixture.entriesMap.set(fixture.childId.replace(/\.ts$/, ''), fixture.childEntry)

    await fixture.loadChild()

    expect(fixture.entriesMap.get(fixture.childKey)?.path).not.toBe(fixture.childId)
    expect(fixture.readDeclaration).not.toHaveBeenCalled()
    expect(fixture.dependencies).toEqual(fixture.expectedDependencies)
  })
})
