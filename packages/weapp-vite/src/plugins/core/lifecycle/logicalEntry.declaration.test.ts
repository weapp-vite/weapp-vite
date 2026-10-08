import type { PluginContext } from 'rolldown'
import type { SidecarModuleKind } from '../../../moduleGraph/protocol'
import type { Entry } from '../../../types'
import type { extractConfigFromVue } from '../../../utils'
import type { CorePluginState } from '../helpers'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogicalEntryId, createSidecarModuleId } from '../../../moduleGraph/protocol'
import { setCompilerSourceSnapshot } from '../../utils/sourceSnapshot'
import { createLogicalEntryLoadHook } from './logicalEntry'

const mocks = vi.hoisted(() => ({
  extractConfigFromVue: vi.fn<typeof extractConfigFromVue>(),
  findJsonEntry: vi.fn(),
  findVueEntry: vi.fn(),
  pathExists: vi.fn(),
}))

vi.mock('../../../utils', () => ({
  extractConfigFromVue: mocks.extractConfigFromVue,
  findCssEntry: vi.fn(async () => ({ path: undefined })),
  findJsEntry: vi.fn(async () => ({ path: undefined })),
  findJsonEntry: mocks.findJsonEntry,
  findTemplateEntry: vi.fn(async () => ({ path: undefined })),
  findVueEntry: mocks.findVueEntry,
  isTemplate: (id: string) => id.endsWith('.wxml'),
}))

vi.mock('../../utils/cache', () => ({ pathExists: mocks.pathExists }))

const fixtureDirectories: string[] = []

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findJsonEntry.mockResolvedValue({ path: undefined })
  mocks.findVueEntry.mockResolvedValue(undefined)
  mocks.extractConfigFromVue.mockResolvedValue(undefined)
})

afterEach(async () => {
  await Promise.all(fixtureDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

async function createFixture(options: { extension?: 'ts' | 'vue', jsonExtension?: 'json' | 'json.ts', selectedAutoRoute?: boolean } = {}) {
  const directory = path.normalize(await mkdtemp(path.join(tmpdir(), 'weapp-logical-declaration-')))
  fixtureDirectories.push(directory)
  const root = path.join(directory, 'src')
  const ownerBase = path.join(root, 'pages/home/index')
  const ownerId = `${ownerBase}.${options.extension ?? 'ts'}`
  const vuePath = `${ownerBase}.vue`
  const jsonPath = options.jsonExtension ? `${ownerBase}.${options.jsonExtension}` : undefined
  const cardId = path.join(root, 'components/card/index.ts')
  const genericId = path.join(root, 'components/generic/index.ts')
  const declaration = {
    usingComponents: { card: '/components/card/index' },
    componentGenerics: { content: { default: '/components/generic/index' } },
  }
  const existingFiles = new Set([ownerId, cardId, genericId, ...jsonPath ? [jsonPath] : []])
  mocks.pathExists.mockImplementation(async (id: string) => existingFiles.has(id))
  mocks.findJsonEntry.mockResolvedValue({ path: jsonPath })
  mocks.findVueEntry.mockResolvedValue(vuePath)

  const dependencies = new Map<SidecarModuleKind, string[]>()
  const entriesMap = new Map<string, Entry | undefined>()
  const state = {
    entriesMap,
    resolvedEntryMap: new Map(),
    loadEntry: vi.fn(),
    ctx: {
      configService: {
        absoluteSrcRoot: root,
        isDev: false,
        platform: 'weapp',
        relativeAbsoluteSrcRoot: (id: string) => path.relative(root, id),
        weappViteConfig: {
          autoRoutes: options.selectedAutoRoute ? { enabled: true, extensions: ['ts'] } : undefined,
        },
      },
      jsonService: { read: vi.fn(async () => declaration) },
      moduleGraphService: {
        bindPluginContext: vi.fn(),
        getEntryDependencies: () => [],
        replaceEntryDependencies: (_ownerId: string, kind: SidecarModuleKind, sources: Iterable<string>) => {
          dependencies.set(kind, [...sources])
        },
      },
      runtimeState: {
        autoRoutes: { pageSourceFiles: new Set(options.selectedAutoRoute ? [ownerId] : []) },
        build: { hmr: { externalComponentEntryMap: new Map() } },
      },
    },
  }
  const pluginContext = {
    addWatchFile: vi.fn(),
    resolve: vi.fn(async (id: string) => ({ id: existingFiles.has(id) ? id : `${id}.ts` })),
  }

  async function loadOwner() {
    const result = await createLogicalEntryLoadHook(state as unknown as CorePluginState)
      .call(pluginContext as unknown as PluginContext, createLogicalEntryId(ownerId, 'page'))
    expect(state.loadEntry).not.toHaveBeenCalled()
    expect(entriesMap.size).toBe(0)
    expect(state.resolvedEntryMap.size).toBe(0)
    return result?.code ?? ''
  }

  function expectDeclaredComponents(code: string) {
    expect(dependencies.get('using-component')).toEqual([cardId, genericId])
    for (const id of [cardId, genericId]) {
      expect(code).toContain(JSON.stringify(createSidecarModuleId(ownerId, id, 'using-component')))
    }
  }

  return { declaration, dependencies, expectDeclaredComponents, jsonPath, loadOwner, ownerBase, ownerId, pluginContext, state, vuePath }
}

describe('unloaded production logical entry declarations', () => {
  it.each(['json', 'json.ts'] as const)('prefers the own .%s service declaration over a sibling Vue file', async (jsonExtension) => {
    const fixture = await createFixture({ jsonExtension })

    const code = await fixture.loadOwner()

    expect(fixture.state.ctx.jsonService.read).toHaveBeenCalledExactlyOnceWith(fixture.jsonPath)
    expect(fixture.dependencies.get('json')).toEqual([fixture.jsonPath])
    fixture.expectDeclaredComponents(code)
    expect(mocks.findVueEntry).not.toHaveBeenCalled()
    expect(mocks.extractConfigFromVue).not.toHaveBeenCalled()
    expect(fixture.pluginContext.addWatchFile).not.toHaveBeenCalledWith(fixture.vuePath)
  })

  it.each(['ts', 'vue'] as const)('reads the %s owner Vue declaration from the compiler snapshot with its context', async (extension) => {
    const fixture = await createFixture({ extension })
    const pinnedSource = `<template><view /></template><json>${JSON.stringify(fixture.declaration)}</json>`
    setCompilerSourceSnapshot(fixture.state.ctx.configService, new Map([[fixture.vuePath, pinnedSource]]))
    mocks.extractConfigFromVue.mockImplementation(async (id, options) => {
      expect(id).toBe(fixture.vuePath)
      expect(options?.compilerContext).toBe(fixture.state.ctx)
      // 临时目录中没有 Vue 文件，绕过快照读取磁盘会使该断言失败。
      expect(await options?.readSource?.()).toBe(pinnedSource)
      return fixture.declaration
    })

    const code = await fixture.loadOwner()

    fixture.expectDeclaredComponents(code)
    expect(fixture.state.ctx.jsonService.read).not.toHaveBeenCalled()
    expect(mocks.extractConfigFromVue).toHaveBeenCalledTimes(1)
    expect(fixture.pluginContext.addWatchFile).toHaveBeenCalledWith(fixture.vuePath)
    if (extension === 'ts') {
      expect(mocks.findVueEntry).toHaveBeenCalledExactlyOnceWith(fixture.ownerBase)
    }
    else {
      expect(mocks.findVueEntry).not.toHaveBeenCalled()
    }
  })

  it('does not read or watch a sibling Vue file when auto routes selected the TS source', async () => {
    const fixture = await createFixture({ selectedAutoRoute: true })
    mocks.extractConfigFromVue.mockResolvedValue(fixture.declaration)

    await fixture.loadOwner()

    expect(fixture.dependencies.get('using-component')).toEqual([])
    expect(fixture.state.ctx.jsonService.read).not.toHaveBeenCalled()
    expect(mocks.findVueEntry).not.toHaveBeenCalled()
    expect(mocks.extractConfigFromVue).not.toHaveBeenCalled()
    expect(fixture.pluginContext.addWatchFile).toHaveBeenCalledExactlyOnceWith(fixture.ownerId)
  })
})
