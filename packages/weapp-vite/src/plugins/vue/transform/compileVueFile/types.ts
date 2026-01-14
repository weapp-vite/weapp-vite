import type { WevuDefaults } from 'wevu'
import type { JsonConfig, JsonMergeStrategy } from '../../../../types'
import type { TemplateCompileOptions, TemplateCompileResult } from '../../compiler/template'

export interface VueTransformResult {
  script?: string
  template?: string
  style?: string
  config?: string
  cssModules?: Record<string, Record<string, string>>
  scopedSlotComponents?: TemplateCompileResult['scopedSlotComponents']
  componentGenerics?: TemplateCompileResult['componentGenerics']
  classStyleWxs?: boolean
  meta?: {
    hasScriptSetup?: boolean
    hasSetupOption?: boolean
    jsonMacroHash?: string
    defineOptionsHash?: string
  }
}

export interface AutoUsingComponentsOptions {
  enabled?: boolean
  resolveUsingComponentPath?: (
    importSource: string,
    importerFilename: string,
    info?: {
      localName: string
      importedName?: string
      kind: 'default' | 'named'
    },
  ) => Promise<string | undefined>
  warn?: (message: string) => void
}

export interface AutoImportTagsOptions {
  enabled?: boolean
  resolveUsingComponent?: (
    tag: string,
    importerFilename: string,
  ) => Promise<{ name: string, from: string } | undefined>
  warn?: (message: string) => void
}

export interface CompileVueFileOptions {
  isPage?: boolean
  isApp?: boolean
  autoUsingComponents?: AutoUsingComponentsOptions
  autoImportTags?: AutoImportTagsOptions
  template?: TemplateCompileOptions
  json?: {
    kind?: 'app' | 'page' | 'component'
    defaults?: JsonConfig['defaults']
    mergeStrategy?: JsonMergeStrategy
  }
  wevuDefaults?: WevuDefaults
}
