import { stripVTControlCharacters } from 'node:util'

const WEB_URL_RE = /Web[\uFF1A:]\s*(https?:\/\/\S+)/i
const TEST_ENV_KEYS = [
  'TEST',
  'VITEST',
  'VITEST_MODE',
  'VITEST_POOL_ID',
  'VITEST_WORKER_ID',
] as const

export function createWebDevServerEnv(source: NodeJS.ProcessEnv) {
  const env = {
    ...source,
    BROWSER: 'none',
    NODE_ENV: 'development',
  }
  for (const key of TEST_ENV_KEYS) {
    delete env[key]
  }
  return env
}

export function resolveWebDevServerUrl(logs: string) {
  const plainLogs = stripVTControlCharacters(logs)
  for (const line of plainLogs.split(/\r?\n/).reverse()) {
    const matchedUrl = line.match(WEB_URL_RE)?.[1]
    if (!matchedUrl) {
      continue
    }
    try {
      return new URL(matchedUrl).toString()
    }
    catch {}
  }
}
