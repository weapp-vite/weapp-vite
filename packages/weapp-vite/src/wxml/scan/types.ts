import type { ComponentsMap, WxmlDep } from '../../types'
import type { Token } from '../shared'

export interface RemovalRange {
  start: number
  end: number
}

export interface WxmlToken {
  /**
   * @description 参与常规组件分析的标签集合。
   * 会应用 `excludeComponent` 过滤，通常会排除宿主内置组件，
   * 供原有的 `usingComponents` 推断与模板依赖聚合使用。
   */
  components: ComponentsMap
  /**
   * @description 供自动导入使用的完整标签集合。
   * 不会因为“这是宿主内置组件名”而被提前过滤，
   * 用来支持“本地组件与内置组件重名时仍优先命中用户组件”的场景。
   */
  autoImportComponents?: ComponentsMap
  deps: WxmlDep[]
  removalRanges: RemovalRange[]
  commentTokens: Token[]
  inlineWxsTokens: Token[]
  wxsImportNormalizeTokens: Token[]
  removeWxsLangAttrTokens: Token[]
  templateImportNormalizeTokens: Token[]
  scriptModuleTagTokens: Token[]
  eventTokens: Token[]
  directiveTokens?: Token[]
  tagNameTokens?: Token[]
  code: string
}
