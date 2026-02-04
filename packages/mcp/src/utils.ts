/**
 * 将字符串中的小写字母转换为大写。
 */
export function format(str: string) {
  return str.replaceAll(/[a-z]/g, s => s.toUpperCase())
}
