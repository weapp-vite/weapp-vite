import type { MutableCompilerContext } from '../../context'
import type { ConfigService } from '../config/types'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_AUTO_IMPORT_MANIFEST_FILENAME,
  getAutoImportConfig,
  getHtmlCustomDataSettings,
  getTypedComponentsSettings,
  resolveManifestOutputPath,
} from '../autoImport/config'
import { createRuntimeState } from '../runtimeState'

const PROJECT_ROOT = '/workspace/project'
const CONFIG_FILE = path.join(PROJECT_ROOT, 'weapp.config.ts')

function createContext(
  weappConfig: Record<string, any> = {},
  overrides: Partial<ConfigService> = {},
): MutableCompilerContext {
  const configService = {
    cwd: PROJECT_ROOT,
    configFilePath: CONFIG_FILE,
    absoluteSrcRoot: path.join(PROJECT_ROOT, 'src'),
    relativeCwd: (p: string) => p,
    relativeSrcRoot: (p: string) => p,
    weappViteConfig: {
      ...weappConfig,
    },
    ...overrides,
  } as unknown as ConfigService

  return {
    runtimeState: createRuntimeState(),
    configService,
  } as MutableCompilerContext
}

describe('autoImport config helpers', () => {
  describe('resolveManifestOutputPath', () => {
    it('returns undefined when config service is missing', () => {
      expect(resolveManifestOutputPath()).toBeUndefined()
    })

    it('falls back to default config when auto import is not configured', () => {
      const ctx = createContext()
      const expected = path.join(PROJECT_ROOT, DEFAULT_AUTO_IMPORT_MANIFEST_FILENAME)
      expect(resolveManifestOutputPath(ctx.configService)).toBe(expected)
    })

    it('uses the config directory and default filename when enabled without output override', () => {
      const ctx = createContext({
        autoImportComponents: {},
      })
      const expected = path.join(PROJECT_ROOT, DEFAULT_AUTO_IMPORT_MANIFEST_FILENAME)
      expect(resolveManifestOutputPath(ctx.configService)).toBe(expected)
    })

    it('resolves relative output paths against the config directory', () => {
      const ctx = createContext({
        autoImportComponents: {
          output: 'dist/manifest.json',
        },
      })
      const expected = path.join(PROJECT_ROOT, 'dist/manifest.json')
      expect(resolveManifestOutputPath(ctx.configService)).toBe(expected)
    })

    it('returns absolute output paths unchanged', () => {
      const absolutePath = '/tmp/custom.json'
      const ctx = createContext({
        autoImportComponents: {
          output: absolutePath,
        },
      })
      expect(resolveManifestOutputPath(ctx.configService)).toBe(absolutePath)
    })

    it('supports enhance.autoImportComponents fallback', () => {
      const ctx = createContext({
        enhance: {
          autoImportComponents: {},
        },
      })
      const expected = path.join(PROJECT_ROOT, DEFAULT_AUTO_IMPORT_MANIFEST_FILENAME)
      expect(resolveManifestOutputPath(ctx.configService)).toBe(expected)
    })

    it('returns undefined when output is explicitly disabled', () => {
      const ctx = createContext({
        autoImportComponents: {
          output: false,
        },
      })
      expect(resolveManifestOutputPath(ctx.configService)).toBeUndefined()
    })

    it('disables manifest when auto import is set to false', () => {
      const ctx = createContext({
        autoImportComponents: false,
      })
      expect(resolveManifestOutputPath(ctx.configService)).toBeUndefined()
    })

    it('prefers main-package output overrides when merging subpackages', () => {
      const ctx = createContext({
        autoImportComponents: {
          output: false,
        },
        subPackages: {
          'packages/order': {
            autoImportComponents: {
              globs: ['packages/order/components/**/*.wxml'],
              output: 'dist/order-manifest.json',
            },
          },
        },
      })
      expect(resolveManifestOutputPath(ctx.configService)).toBeUndefined()
    })

    it('falls back to subpackage config when base config is absent', () => {
      const ctx = createContext({
        subPackages: {
          'packages/order': {
            autoImportComponents: {
              globs: ['packages/order/components/**/*.wxml'],
              output: 'dist/order-manifest.json',
            },
          },
        },
      })
      const expected = path.join(PROJECT_ROOT, 'dist/order-manifest.json')
      expect(resolveManifestOutputPath(ctx.configService)).toBe(expected)
    })
  })

  describe('getAutoImportConfig defaults', () => {
    it('provides default globs for main package components directory', () => {
      const ctx = createContext()
      const config = getAutoImportConfig(ctx.configService)
      expect(config?.globs).toContain('components/**/*.wxml')
    })

    it('extends default globs with configured subpackage roots', () => {
      const ctx = createContext({
        subPackages: {
          'packages/order': {},
          'marketing': {},
        },
      })
      const config = getAutoImportConfig(ctx.configService)
      expect(config?.globs).toEqual(
        expect.arrayContaining([
          'components/**/*.wxml',
          'packages/order/components/**/*.wxml',
          'marketing/components/**/*.wxml',
        ]),
      )
    })

    it('omits default subpackage globs when subpackage disables auto import', () => {
      const ctx = createContext({
        subPackages: {
          'packages/order': {
            autoImportComponents: false,
          },
          'marketing': {},
        },
      })
      const config = getAutoImportConfig(ctx.configService)
      expect(config?.globs).toEqual(
        expect.arrayContaining([
          'components/**/*.wxml',
          'marketing/components/**/*.wxml',
        ]),
      )
      expect(config?.globs).not.toContain('packages/order/components/**/*.wxml')
    })

    it('returns undefined for scoped subpackage when auto import disabled', () => {
      const ctx = createContext({
        subPackages: {
          'packages/order': {
            autoImportComponents: false,
          },
        },
      }, {
        currentSubPackageRoot: 'packages/order',
      })
      expect(getAutoImportConfig(ctx.configService)).toBeUndefined()
    })

    it('returns undefined when global auto import disabled via false', () => {
      const ctx = createContext({
        autoImportComponents: false,
      })
      expect(getAutoImportConfig(ctx.configService)).toBeUndefined()
    })
  })

  describe('getTypedComponentsSettings', () => {
    it('disables typed components when not configured', () => {
      const ctx = createContext()
      expect(getTypedComponentsSettings(ctx)).toEqual({ enabled: false })
    })

    it('returns default path when enabled with boolean true', () => {
      const ctx = createContext({
        autoImportComponents: {
          typedComponents: true,
        },
      })
      const result = getTypedComponentsSettings(ctx)
      expect(result.enabled).toBe(true)
      expect(result.outputPath).toBe(path.join(PROJECT_ROOT, 'typed-components.d.ts'))
    })

    it('resolves relative output paths for typed components', () => {
      const ctx = createContext({
        autoImportComponents: {
          typedComponents: 'types/typed.d.ts',
        },
      })
      const result = getTypedComponentsSettings(ctx)
      expect(result.enabled).toBe(true)
      expect(result.outputPath).toBe(path.join(PROJECT_ROOT, 'types/typed.d.ts'))
    })

    it('ignores empty string typed component option', () => {
      const ctx = createContext({
        autoImportComponents: {
          typedComponents: '   ',
        },
      })
      expect(getTypedComponentsSettings(ctx)).toEqual({ enabled: false })
    })

    it('supports enhance fallback for typed component option', () => {
      const ctx = createContext({
        enhance: {
          autoImportComponents: {
            typedComponents: true,
          },
        },
      })
      const result = getTypedComponentsSettings(ctx)
      expect(result.enabled).toBe(true)
      expect(result.outputPath).toBe(path.join(PROJECT_ROOT, 'typed-components.d.ts'))
    })

    it('prefers scoped subpackage settings when building independent bundles', () => {
      const ctx = createContext({
        autoImportComponents: {
          typedComponents: 'types/root.d.ts',
        },
        subPackages: {
          'packages/order': {
            autoImportComponents: {
              typedComponents: 'types/order.d.ts',
            },
          },
        },
      }, {
        currentSubPackageRoot: 'packages/order',
      })
      const result = getTypedComponentsSettings(ctx)
      expect(result.enabled).toBe(true)
      expect(result.outputPath).toBe(path.join(PROJECT_ROOT, 'types/order.d.ts'))
    })
  })

  describe('getHtmlCustomDataSettings', () => {
    it('disables html custom data when not configured', () => {
      const ctx = createContext()
      expect(getHtmlCustomDataSettings(ctx)).toEqual({ enabled: false })
    })

    it('returns default path when html custom data is enabled', () => {
      const ctx = createContext({
        autoImportComponents: {
          htmlCustomData: true,
        },
      })
      const result = getHtmlCustomDataSettings(ctx)
      expect(result.enabled).toBe(true)
      expect(result.outputPath).toBe(path.join(PROJECT_ROOT, 'mini-program.html-data.json'))
    })

    it('resolves relative html custom data paths', () => {
      const ctx = createContext({
        autoImportComponents: {
          htmlCustomData: 'support/custom.json',
        },
      })
      const result = getHtmlCustomDataSettings(ctx)
      expect(result.enabled).toBe(true)
      expect(result.outputPath).toBe(path.join(PROJECT_ROOT, 'support/custom.json'))
    })

    it('ignores empty html custom data option', () => {
      const ctx = createContext({
        autoImportComponents: {
          htmlCustomData: '',
        },
      })
      expect(getHtmlCustomDataSettings(ctx)).toEqual({ enabled: false })
    })

    it('supports enhance fallback for html custom data option', () => {
      const ctx = createContext({
        enhance: {
          autoImportComponents: {
            htmlCustomData: true,
          },
        },
      })
      const result = getHtmlCustomDataSettings(ctx)
      expect(result.enabled).toBe(true)
      expect(result.outputPath).toBe(path.join(PROJECT_ROOT, 'mini-program.html-data.json'))
    })
  })
})
