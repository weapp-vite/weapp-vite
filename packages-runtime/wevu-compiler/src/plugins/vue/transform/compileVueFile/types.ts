import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { AstEngineName } from '../../../../ast/types'
import type { JsonConfig, JsonMergeStrategy } from '../../../../types/json'
import type { WevuDefaults } from '../../../../types/wevu'
import type { EncodedSourceMapLike } from '../../../../utils/sourcemap'
import type { ResolveSfcBlockSrcOptions } from '../../../utils/vueSfc'
import type { TemplateCompileOptions, TemplateCompileResult } from '../../compiler/template'

export interface ResolvedUsingComponentInfo {
  from?: string
  resolvedId?: string
  sourceType?: 'wevu-sfc' | 'native'
}

export type ResolvedUsingComponentPath = string | ResolvedUsingComponentInfo

/**
 * Vue 单文件组件转换结果。
 */
export interface VueTransformResult {
  script?: string
  scriptMap?: EncodedSourceMapLike | null
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
    styleBlocks?: SFCStyleBlock[]
  }
}

/**
 * 自动生成 usingComponents 选项。
 */
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
  ) => Promise<ResolvedUsingComponentPath | undefined>
  warn?: (message: string) => void
}

/**
 * 自动导入模板标签组件选项。
 */
export interface AutoImportTagsOptions {
  enabled?: boolean
  resolveUsingComponent?: (
    tag: string,
    importerFilename: string,
  ) => Promise<({ name: string, from: string } & ResolvedUsingComponentInfo) | undefined>
  warn?: (message: string) => void
}

/**
 * 编译 Vue SFC 的选项集合。
 */
export interface CompileVueFileOptions {
  astEngine?: AstEngineName
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
