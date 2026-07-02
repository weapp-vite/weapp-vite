import { beforeEach, describe, expect, it, vi } from 'vitest'

const collectScriptSetupImportsFromCodeMock = vi.hoisted(() => vi.fn(() => []))
const readAndParseSfcMock = vi.hoisted(() => vi.fn())
const resolveUsingComponentReferenceMock = vi.hoisted(() => vi.fn())
const createReadAndParseSfcOptionsMock = vi.hoisted(() => vi.fn(() => ({
  checkMtime: false,
  resolveSrc: {
    resolveId: vi.fn(),
    checkMtime: false,
  },
})))

vi.mock('../../../../ast', async () => {
  const actual = await vi.importActual<typeof import('../../../../ast')>('../../../../ast')
  return {
    ...actual,
    collectScriptSetupImportsFromCode: collectScriptSetupImportsFromCodeMock,
  }
})

vi.mock('../../../vue/transform/usingComponentResolver', () => ({
  resolveUsingComponentReference: resolveUsingComponentReferenceMock,
}))

vi.mock('../../../utils/vueSfc', () => ({
  createReadAndParseSfcOptions: createReadAndParseSfcOptionsMock,
  readAndParseSfc: readAndParseSfcMock,
}))

vi.mock('../../../../logger', () => ({
  default: {
    warn: vi.fn(),
  },
}))

describe('applyScriptSetupUsingComponents ast engine smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readAndParseSfcMock.mockResolvedValue({
      descriptor: {
        template: {
          content: '<TButton />',
        },
        scriptSetup: {
          content: `
import TButton from './TButton'
          `.trim(),
        },
      },
      errors: [],
    })
    resolveUsingComponentReferenceMock.mockResolvedValue({
      from: undefined,
      resolvedId: undefined,
    })
  })

  it('passes resolved astEngine into script setup import analysis', async () => {
    const { applyScriptSetupUsingComponents } = await import('./template')

    await applyScriptSetupUsingComponents({
      pluginCtx: {
        resolve: vi.fn(),
      } as any,
      vueEntryPath: '/project/src/components/demo.vue',
      source: '<template><TButton /></template><script setup>import TButton from "./TButton"</script>',
      templatePath: '',
      json: {},
      configService: {
        isDev: false,
        weappViteConfig: {
          ast: {
            engine: 'oxc',
          },
        },
      } as any,
      reExportResolutionCache: new Map(),
    })

    expect(collectScriptSetupImportsFromCodeMock).toHaveBeenCalledWith(
      expect.stringContaining('import TButton'),
      new Set(['TButton']),
      {
        astEngine: 'oxc',
      },
    )
    expect(createReadAndParseSfcOptionsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      {
        source: '<template><TButton /></template><script setup>import TButton from "./TButton"</script>',
      },
    )
  })

  it('resolves script setup usingComponents concurrently and applies them in import order', async () => {
    const { applyScriptSetupUsingComponents } = await import('./template')
    const json: any = {
      usingComponents: {
        SlowCard: '/legacy/slow-card',
      },
    }
    const externalComponentEntryMap = new Map<string, string>()
    const startedBeforeRelease: string[] = []
    let releaseSlow: (() => void) | undefined
    let slowReleased = false

    readAndParseSfcMock.mockResolvedValue({
      descriptor: {
        template: {
          content: '<SlowCard /><FastCard />',
        },
        scriptSetup: {
          content: `
import SlowCard from './SlowCard'
import FastCard from './FastCard'
          `.trim(),
        },
      },
      errors: [],
    })
    collectScriptSetupImportsFromCodeMock.mockReturnValue([
      {
        localName: 'SlowCard',
        importSource: './SlowCard',
        kind: 'default',
      },
      {
        localName: 'FastCard',
        importSource: './FastCard',
        kind: 'default',
      },
    ])
    resolveUsingComponentReferenceMock.mockImplementation(async (_ctx, _configService, _cache, importSource: string) => {
      if (!slowReleased) {
        startedBeforeRelease.push(importSource)
      }
      if (importSource === './SlowCard') {
        await new Promise<void>((resolve) => {
          releaseSlow = () => {
            slowReleased = true
            resolve()
          }
        })
        return {
          from: '/components/slow-card/index',
          resolvedId: '/project/src/components/slow-card/index.vue',
        }
      }
      return {
        from: '/components/fast-card/index',
        resolvedId: '/project/src/components/fast-card/index.vue',
      }
    })

    const pending = applyScriptSetupUsingComponents({
      pluginCtx: {
        resolve: vi.fn(),
      } as any,
      vueEntryPath: '/project/src/pages/demo/index.vue',
      templatePath: '',
      json,
      configService: {
        isDev: false,
        weappViteConfig: {},
      } as any,
      reExportResolutionCache: new Map(),
      externalComponentEntryMap,
    })

    await vi.waitFor(() => {
      expect(releaseSlow).toBeDefined()
      expect(startedBeforeRelease).toEqual(['./SlowCard', './FastCard'])
    })
    releaseSlow?.()
    await pending

    expect(json.usingComponents).toEqual({
      SlowCard: '/components/slow-card/index',
      FastCard: '/components/fast-card/index',
    })
    expect(externalComponentEntryMap).toEqual(new Map([
      ['components/slow-card/index', '/project/src/components/slow-card/index.vue'],
      ['components/fast-card/index', '/project/src/components/fast-card/index.vue'],
    ]))
  })
})
