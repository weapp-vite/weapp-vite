import type { JsonConfig, JsonMergeStrategy } from '../../../../types/json'
import type { WevuDefaults } from '../../../../types/wevu'
import type { ResolveSfcBlockSrcOptions } from '../../../utils/vueSfc'
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
    sfcSrcDeps?: string[]
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
  warn?: (message: string) => void
  autoUsingComponents?: AutoUsingComponentsOptions
  autoImportTags?: AutoImportTagsOptions
  template?: TemplateCompileOptions
  json?: {
    kind?: 'app' | 'page' | 'component'
    defaults?: JsonConfig['defaults']
    mergeStrategy?: JsonMergeStrategy
  }
  sfcSrc?: ResolveSfcBlockSrcOptions
  wevuDefaults?: WevuDefaults
}
