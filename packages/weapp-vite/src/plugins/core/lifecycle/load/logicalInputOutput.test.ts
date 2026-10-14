import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogicalEntryId } from '../../../../moduleGraph/protocol'
import { normalizeSourceId } from '../../../../moduleGraph/traversal'
import { createOptionsHook } from './options'

let root: string

async function source(file: string, code: string) {
  const target = path.join(root, file)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, code)
  return target
}

function createState(usingComponents: Record<string, string>) {
  const appEntry = { path: path.join(root, 'app.ts'), json: { pages: [], usingComponents } }
  return {
    ctx: {
      configService: {
        absoluteSrcRoot: root,
        isDev: false,
        weappViteConfig: {},
        options: {},
        relativeAbsoluteSrcRoot: (id: string) => path.relative(root, id),
        relativeOutputPath: vi.fn((id: string) => path.relative(root, id)),
      },
      scanService: {
        appEntry,
        loadAppEntry: async () => appEntry,
        loadSubPackages: vi.fn(),
        drainIndependentDirtyRoots: () => [],
        independentSubPackageMap: new Map(),
      },
      runtimeState: {
        lib: { enabled: false, entries: new Map() },
        build: { independent: { outputs: new Map(), pendingOutputs: [] } },
      },
      buildService: {},
    },
    entriesMap: new Map(),
    hmrRootInputIds: new Set<string>(),
  }
}

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-logical-input-output-'))
  await source('app.ts', 'App({})')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('logical component input output paths', () => {
  it.each(['ts', 'vue'])('uses the resolved index.%s path for directory declarations', async (extension) => {
    const component = await source(`components/Test/index.${extension}`, extension === 'ts' ? 'Component({})' : '<template><view /></template>')
    const state = createState({ Test: '/components/Test' })
    const options: { input?: Record<string, string> } = {}

    await createOptionsHook(state as any)(options)

    expect(options.input).toEqual({
      'app': createLogicalEntryId(path.join(root, 'app.ts'), 'app'),
      'components/Test/index': createLogicalEntryId(component, 'component'),
    })
    expect(state.ctx.configService.relativeOutputPath).toHaveBeenCalledWith(component)
  })

  it('deduplicates directory and explicit index declarations on the same physical output', async () => {
    const component = await source('components/Test/index.ts', 'Component({})')
    const state = createState({ Test: '/components/Test', Alias: '/components/Test/index' })
    const options: { input?: Record<string, string> } = {}

    await createOptionsHook(state as any)(options)

    expect(options.input).toEqual({
      'app': createLogicalEntryId(path.join(root, 'app.ts'), 'app'),
      'components/Test/index': createLogicalEntryId(component, 'component'),
    })
    expect([...state.hmrRootInputIds]).toEqual([normalizeSourceId(path.join(root, 'app.ts')), normalizeSourceId(component)])
  })

  it('shares the configured component output mapping with asset emission', async () => {
    const component = await source('components/Test/index.ts', 'Component({})')
    const state = createState({ Test: '/components/Test' })
    state.ctx.configService.relativeOutputPath.mockReturnValue('plugin-dist/components/Test/index.ts')
    const options: { input?: Record<string, string> } = {}

    await createOptionsHook(state as any)(options)

    expect(options.input).toEqual({
      'app': createLogicalEntryId(path.join(root, 'app.ts'), 'app'),
      'plugin-dist/components/Test/index': createLogicalEntryId(component, 'component'),
    })
  })

  it.each(['components/Card.v2.ts', 'components/Test/index.weapp.vue'])('preserves dots in the physical component name: %s', async (file) => {
    const component = await source(file, file.endsWith('.ts') ? 'Component({})' : '<template><view /></template>')
    const state = createState({ Card: `/${file}` })
    const options: { input?: Record<string, string> } = {}

    await createOptionsHook(state as any)(options)

    expect(options.input).toEqual({
      app: createLogicalEntryId(path.join(root, 'app.ts'), 'app'),
      [file.slice(0, -path.extname(file).length)]: createLogicalEntryId(component, 'component'),
    })
  })
})
