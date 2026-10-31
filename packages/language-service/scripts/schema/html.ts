import type { ComponentAttribute } from '../../src/schema/types.ts'

/** 文档表格只读提取；实体解码只影响说明资产，不参与用户模板格式化。 */
export function textContent(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&#(x[\da-f]+|\d+);/gi, (_, entity: string) => String.fromCodePoint(entity.startsWith('x') ? Number.parseInt(entity.slice(1), 16) : Number(entity))).replace(/&(?:amp|quot|apos|lt|gt|nbsp);/g, entity => ({ '&amp;': '&', '&quot;': '"', '&apos;': '\'', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' })[entity] ?? entity).replace(/\p{Zs}/gu, ' ').trim()
}

/** 仅接收有明确属性名和类型列的官方表格，跳过普通值说明表。 */
export function attributesFromRows(rows: string[][]): ComponentAttribute[] {
  const header = rows[0] ?? []
  const name = header.findIndex(cell => /^(?:属性(?:名|名称)?|参数(?:名|名称)?|名称|attribute)$/i.test(cell.trim()))
  const type = header.findIndex(cell => /^(?:类型|type)$/i.test(cell.trim()))
  if (name < 0 || type < 0) {
    return []
  }
  const description = header.findIndex(cell => /说明|描述|description/i.test(cell))
  const defaultValue = header.findIndex(cell => /默认|default/i.test(cell))
  return rows.slice(1).flatMap((row) => {
    const attribute = row[name]?.trim()
    if (!attribute || !/^[\w:@.-]+$/.test(attribute)) {
      return []
    }
    return [{ name: attribute, type: { name: row[type] ?? '' }, ...(description >= 0 && row[description] ? { desc: [row[description]] } : {}), ...(defaultValue >= 0 && row[defaultValue] ? { defaultValue: row[defaultValue] } : {}) }]
  })
}

/** 从服务端渲染的官方文档收集属性表，不执行页面脚本。 */
export function attributesFromHtml(html: string): ComponentAttribute[] {
  const attributes: ComponentAttribute[] = []
  for (const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const rows = [...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(row => [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(cell => textContent(cell[1])))
    attributes.push(...attributesFromRows(rows))
  }
  return [...new Map(attributes.map(attribute => [attribute.name, attribute])).values()]
}

/** 静态状态数据可能含 undefined；仅替换字符串外的该字面量，禁止执行远端代码。 */
export function parseStaticState(source: string): unknown {
  let quote = false
  let escaped = false
  let json = ''
  for (let index = 0; index < source.length; index++) {
    const char = source[index]
    if (quote) {
      json += char
      if (escaped) {
        escaped = false
      }
      else if (char === '\\') {
        escaped = true
      }
      else if (char === '"') {
        quote = false
      }
    }
    else if (char === '"') {
      quote = true
      json += char
    }
    else if (source.startsWith('undefined', index)) {
      json += 'null'
      index += 8
    }
    else {
      json += char
    }
  }
  return JSON.parse(json.replace(/;\s*$/, '')) as unknown
}

/** 从静态页面状态中截取单个 JSON 对象，避开无关的事件回调和登录状态。 */
export function extractStaticObject(source: string, key: string): unknown {
  const position = source.indexOf(`"${key}":`)
  const start = source.indexOf('{', position)
  if (position < 0 || start < 0) {
    throw new Error(`文档状态缺少 ${key}`)
  }
  let depth = 0
  let quote = false
  let escaped = false
  for (let index = start; index < source.length; index++) {
    const char = source[index]
    if (quote) {
      if (escaped) {
        escaped = false
      }
      else if (char === '\\') {
        escaped = true
      }
      else if (char === '"') {
        quote = false
      }
    }
    else if (char === '"') {
      quote = true
    }
    else if (char === '{') {
      depth++
    }
    else if (char === '}' && --depth === 0) {
      return parseStaticState(source.slice(start, index + 1))
    }
  }
  throw new Error(`文档状态中的 ${key} 未闭合`)
}
