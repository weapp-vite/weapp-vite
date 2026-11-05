import type { TemplateInputOptions } from './templateInput'
import { resolveTemplateInput, templateInputPlatforms } from './templateInput'

const INPUT_QUERY = 'weapp-web-input'
const platforms = new Set<string>(templateInputPlatforms)

/** 依赖模块身份携带非默认输入规则，避免独立 load 丢失父模板来源。 */
export function appendTemplateInputQuery(request: string, input: TemplateInputOptions): string {
  if (JSON.stringify(input) === JSON.stringify(resolveTemplateInput(request))) {
    return request
  }
  const query = new URLSearchParams({ [INPUT_QUERY]: JSON.stringify(input) })
  return `${request}${request.includes('?') ? '&' : '?'}${query}`
}

/** 查询参数是模块边界输入，先验证结构再交给共享 parser。 */
export function readTemplateInputQuery(id: string): TemplateInputOptions | undefined {
  const queryStart = id.indexOf('?')
  const value = queryStart < 0 ? null : new URLSearchParams(id.slice(queryStart + 1)).get(INPUT_QUERY)
  if (value === null) {
    return undefined
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  }
  catch {
    throw new Error('[web] 模板输入配置查询参数不是有效 JSON')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('[web] 模板输入配置查询参数必须是对象')
  }
  const { platform, syntax, rawTags } = parsed as Record<string, unknown>
  if ((platform !== undefined && (typeof platform !== 'string' || !platforms.has(platform)))
    || (syntax !== undefined && syntax !== 'xml' && syntax !== 'legacy')
    || (rawTags !== undefined && (!Array.isArray(rawTags) || !rawTags.every(tag => typeof tag === 'string')))) {
    throw new Error('[web] 模板输入配置查询参数包含无效平台、语法或原始标签')
  }
  return { platform, syntax, rawTags } as TemplateInputOptions
}
