import { stripVTControlCharacters } from 'node:util'

/** 只采用原生 CLI 明确且不矛盾的 login 布尔字段，不推断日志语义。 */
export function readWechatLoginState(stdout: string): boolean | undefined {
  const results = new Set<boolean>()
  for (const line of stripVTControlCharacters(stdout).split(/\r?\n/)) {
    try {
      const value: unknown = JSON.parse(line)
      if (value && typeof value === 'object' && 'login' in value && typeof value.login === 'boolean') {
        results.add(value.login)
      }
    }
    catch {}
  }
  return results.size === 1 ? [...results][0] : undefined
}
