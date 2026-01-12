import type { HtmlCustomDataTag } from './htmlCustomDataTypes'
import { WEAPP_BUILTIN_HTML_TAGS } from './weappBuiltinHtmlTagsData'

export function loadWeappBuiltinHtmlTags(): HtmlCustomDataTag[] {
  return WEAPP_BUILTIN_HTML_TAGS
}
