import { beforeEach, describe, expect, it, vi } from 'vitest'

const getAutoImportConfigMock = vi.hoisted(() => vi.fn(() => ({ resolvers: [] })))
const loadExternalComponentMetadataMock = vi.hoisted(() => vi.fn())
const extractJsonPropMetadataMock = vi.hoisted(() => vi.fn(() => ({
  props: new Map(),
  docs: new Map(),
})))

vi.mock('../config', () => ({
  getAutoImportConfig: getAutoImportConfigMock,
}))

vi.mock('../externalMetadata', () => ({
  loadExternalComponentMetadata: loadExternalComponentMetadataMock,
}))

vi.mock('../metadata', () => ({
  extractJsonPropMetadata: extractJsonPropMetadataMock,
}))

vi.mock('../../../context/shared', () => ({
  logger: {
    debug: vi.fn(),
  },
}))

describe('autoImport metadata ast engine smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadExternalComponentMetadataMock.mockReturnValue({
      types: new Map([['size', 'string']]),
    })
  })

  it('passes resolved astEngine into external metadata loading', async () => {
    const { createMetadataHelpers } = await import('./metadata')

    const helpers = createMetadataHelpers({
      ctx: {
        configService: {
          cwd: '/project',
          absoluteSrcRoot: '/project/src',
          weappViteConfig: {
            ast: {
              engine: 'oxc',
            },
          },
        },
      },
      registry: new Map(),
      componentMetadataMap: new Map(),
      resolverComponentNames: new Set(['TButton']),
      resolverComponentsMapRef: {
        value: {
          TButton: 'tdesign-miniprogram/button/button',
        },
      },
      manifestCache: new Map(),
      collectResolverComponents: () => ({
        TButton: 'tdesign-miniprogram/button/button',
      }),
    } as any)

    const metadata = helpers.getComponentMetadata('TButton')

    expect(loadExternalComponentMetadataMock).toHaveBeenCalledWith(
      'tdesign-miniprogram/button/button',
      '/project',
      [],
      {
        astEngine: 'oxc',
      },
    )
    expect(metadata.types.get('size')).toBe('string')
  })
})
