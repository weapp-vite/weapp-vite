/**
 * @description 以 2 空格缩进序列化 JSON
 */
export function toJsonString(value: unknown) {
  return JSON.stringify(value, undefined, 2)
}
