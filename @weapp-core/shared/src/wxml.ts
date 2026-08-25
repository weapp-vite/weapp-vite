const WXML_TEXT_ESCAPE_RE = /[&<>]/g
const WXML_ATTRIBUTE_ESCAPE_RE = /[&"<]/g

const WXML_TEXT_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
}

const WXML_ATTRIBUTE_ESCAPE_MAP: Record<string, string> = {
  ...WXML_TEXT_ESCAPE_MAP,
  '"': '&quot;',
}

/**
 * @description 按 exparser 与 glass-easel 的共同规则序列化 WXML 静态文本。
 */
export function escapeWxmlText(value: string) {
  return value.replace(WXML_TEXT_ESCAPE_RE, char => WXML_TEXT_ESCAPE_MAP[char] ?? char)
}

/**
 * @description 按 exparser 与 glass-easel 的共同规则序列化双引号 WXML 属性值。
 */
export function escapeWxmlAttribute(value: string) {
  return value.replace(WXML_ATTRIBUTE_ESCAPE_RE, char => WXML_ATTRIBUTE_ESCAPE_MAP[char] ?? char)
}
