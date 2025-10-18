import type { MutableCompilerContext } from '../../context'
import type { ConfigService } from '../config/types'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_AUTO_IMPORT_MANIFEST_FILENAME,
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

    it('returns undefined when auto import is not configured', () => {
      const ctx = createContext()
      expect(resolveManifestOutputPath(ctx.configService)).toBeUndefined()
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
