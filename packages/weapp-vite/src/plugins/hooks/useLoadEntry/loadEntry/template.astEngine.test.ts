import { beforeEach, describe, expect, it, vi } from 'vitest'

const collectScriptSetupImportsFromCodeMock = vi.hoisted(() => vi.fn(() => []))
const readAndParseSfcMock = vi.hoisted(() => vi.fn())

vi.mock('../../../../ast/operations/scriptSetupImports', () => ({
  collectScriptSetupImportsFromCode: collectScriptSetupImportsFromCodeMock,
}))

vi.mock('../../../utils/vueSfc', () => ({
  getSfcCheckMtime: vi.fn(() => false),
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
