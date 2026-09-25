import { stripVTControlCharacters } from 'node:util'

/** 去除 CLI 彩色控制序列后读取内部构建耗时，缺失时不伪造数据。 */
export function parseCliBuildMs(output: string): number | null {
  const text = stripVTControlCharacters(output)
  const match = text.match(/(?:built in|耗时：)\s*(\d+(?:\.\d+)?)\s*(ms|s)\b/)
  if (!match) {
    return null
  }
  return Number(match[1]) * (match[2] === 's' ? 1000 : 1)
}
