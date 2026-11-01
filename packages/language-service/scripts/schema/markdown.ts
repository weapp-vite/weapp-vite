import type { ComponentAttribute } from '../../src/schema/types.ts'
import { attributesFromRows, textContent } from './html.ts'

/** 读取 Markdown 属性表，跳过 fenced code 并保留转义的竖线。 */
export function attributesFromMarkdown(source: string): ComponentAttribute[] {
  const attributes: ComponentAttribute[] = []
  let rows: string[][] = []
  let fence = false
  const flush = () => {
    attributes.push(...attributesFromRows(rows.filter(row => !row.every(cell => /^:?-+:?$/.test(cell)))))
    rows = []
  }
  for (const line of source.split(/\r?\n/)) {
    if (/^\s*(?:```|~~~)/.test(line)) {
      fence = !fence
    }
    if (fence || !/^\s*\|/.test(line)) {
      flush()
      continue
    }
    const cells = line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(cell => textContent(cell.replace(/\\\|/g, '|').replace(/`/g, '')))
    rows.push(cells)
  }
  flush()
  return [...new Map(attributes.map(attribute => [attribute.name, attribute])).values()]
}
