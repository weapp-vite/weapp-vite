export function format(str: string) {
  return str.replaceAll(/[a-z]/g, s => s.toUpperCase())
}
