/**
 * @file 标识与格式化工具。
 */
import { randomUUID } from 'node:crypto'

function padZero(value: number, width = 2) {
  return String(value).padStart(width, '0')
}

/** dateFormat 的方法封装。 */
export function dateFormat(mask: string, value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)

  return mask
    .replace('yyyy', String(date.getFullYear()))
    .replace('mm', padZero(date.getMonth() + 1))
    .replace('dd', padZero(date.getDate()))
    .replace('HH', padZero(date.getHours()))
    .replace('MM', padZero(date.getMinutes()))
    .replace('ss', padZero(date.getSeconds()))
    .replace('l', padZero(date.getMilliseconds(), 3))
}

/** uuid 的方法封装。 */
export function uuid() {
  return randomUUID()
}
