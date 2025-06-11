import process from 'node:process'

export const isWindows
  = typeof process !== 'undefined' && process.platform === 'win32'

const windowsSlashRE = /\\/g
export function slash(p: string): string {
  return p.replace(windowsSlashRE, '/')
}

const postfixRE = /[?#].*$/
export function cleanUrl(url: string): string {
  return url.replace(postfixRE, '')
}

export function splitFileAndPostfix(path: string): {
  file: string
  postfix: string
} {
  const file = cleanUrl(path)
  return { file, postfix: path.slice(file.length) }
}

export function isPrimitive(value: unknown): boolean {
  return !value || (typeof value !== 'object' && typeof value !== 'function')
}

export function withTrailingSlash(path: string): string {
  if (path[path.length - 1] !== '/') {
    return `${path}/`
  }
  return path
}

export const AsyncFunction = async function () {}.constructor as typeof Function
