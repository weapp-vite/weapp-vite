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
  slotFallbackWrapperComponent?: TemplateCompileResult['slotFallbackWrapperComponent']
  componentGenerics?: TemplateCompileResult['componentGenerics']
  classStyleWxs?: boolean
  meta?: {
    hasScriptSetup?: boolean
    hasSetupOption?: boolean
    jsonMacroHash?: string
    defineOptionsHash?: string
    sfcSrcDeps?: string[]
    styleBlocks?: SFCStyleBlock[]
    /**
     * JSON-only HMR 重算所需的稳定编译输入。
     *
     * @internal
     */
    jsonConfigCache?: {
      autoImportTagsMap?: Record<string, string>
      autoUsingComponentsMap: Record<string, string>
    }
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

export interface VueSfcStaticComponentMeta {
  componentName?: string
  isMiniProgramComponent: boolean
}

/**
 * 编译 Vue SFC 的选项集合。
 */
export interface CompileVueFileOptions {
  astEngine?: AstEngineName
  isPage?: boolean
  isApp?: boolean
  /**
   * 是否压缩生成的 wevu 脚本输出。
   */
  minify?: boolean
  /**
   * 是否生成脚本 sourcemap。默认开启；构建工具可在未启用 sourcemap 时显式关闭以减少 codegen 成本。
   */
  sourceMap?: boolean
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
  /**
   * 缓存被当前 SFC 引用的 Vue 组件静态元信息，避免重复读取和解析同一组件。
   */
  componentMetaCache?: Map<string, Promise<VueSfcStaticComponentMeta>>
}
