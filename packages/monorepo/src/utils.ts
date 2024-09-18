export function escapeStringRegexp(str: string) {
  return str
    .replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
    .replace(/-/g, '\\x2d')
}

export function isMatch(str: string, arr: RegExp[]) {
  for (const reg of arr) {
    if (reg.test(str)) {
      return true
    }
  }
  return false
}
