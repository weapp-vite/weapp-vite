import { parse } from 'yaml'

const DOCUMENT_START = '---\n'
const DOCUMENT_SEPARATOR = '\n---\n'

/** 按 pnpm 的锁文件约定跳过首个环境文档，只解析项目依赖，兼容旧单文档与 Windows 换行。 */
export function parsePnpmLockfile(source, filePath = 'pnpm-lock.yaml') {
  let content = source.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n')
  if (content.startsWith(DOCUMENT_START)) {
    const separator = content.indexOf(DOCUMENT_SEPARATOR, DOCUMENT_START.length)
    content = separator === -1 ? '' : content.slice(separator + DOCUMENT_SEPARATOR.length)
  }
  const lockfile = parse(content)
  if (lockfile == null) {
    throw new Error(`pnpm lockfile is empty: ${filePath}`)
  }
  if (typeof lockfile !== 'object' || Array.isArray(lockfile)) {
    throw new TypeError(`pnpm lockfile must contain a mapping: ${filePath}`)
  }
  return lockfile
}
