import { beforeEach, describe, expect, it, vi } from 'vitest'

const collectScriptSetupImportsFromCodeMock = vi.hoisted(() => vi.fn(() => []))
const readAndParseSfcMock = vi.hoisted(() => vi.fn())
const createReadAndParseSfcOptionsMock = vi.hoisted(() => vi.fn(() => ({
  checkMtime: false,
  resolveSrc: {
    resolveId: vi.fn(),
    checkMtime: false,
  },
})))

vi.mock('../../../../ast/operations', () => ({
  collectScriptSetupImportsFromCode: collectScriptSetupImportsFromCodeMock,
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
  })

  it('passes resolved astEngine into script setup import analysis', async () => {
    const { applyScriptSetupUsingComponents } = await import('./template')

    await applyScriptSetupUsingComponents({
      pluginCtx: {
        resolve: vi.fn(),
      } as any,
      vueEntryPath: '/project/src/components/demo.vue',
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
  })
})
