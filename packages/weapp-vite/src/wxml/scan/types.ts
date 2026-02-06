import type { ComponentsMap, WxmlDep } from '../../types'
import type { Token } from '../shared'

export interface RemovalRange {
  start: number
  end: number
}

export interface WxmlToken {
  components: ComponentsMap
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
