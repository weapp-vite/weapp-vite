const LEADING_SLASH_RE = /^\/+/
const DEFAULT_WAIT_TIMEOUT = 1_000
const DEFAULT_WAIT_INTERVAL = 10

export function normalizeRoute(route: string) {
  return route.replace(LEADING_SLASH_RE, '')
}

export function resolvePageScopeId(scopeId: string) {
  const pagePathIndex = scopeId.indexOf('/page/')
  return pagePathIndex >= 0 ? scopeId.slice(0, pagePathIndex) : scopeId
}

export function normalizeNonEmptyInput(value: string, label: string) {
  const normalizedValue = value.trim()
  if (!normalizedValue) {
    throw new Error(`${label} must be a non-empty string in headless testing runtime.`)
  }
  return normalizedValue
}

async function waitForDelay(ms = 0) {
  if (ms <= 0) {
    return
  }
  await new Promise(resolve => setTimeout(resolve, ms))
}

export async function pollUntil<T>(
  check: () => Promise<T | null>,
  errorMessage: string,
  options: { interval?: number, timeout?: number } = {},
) {
  const timeout = Number.isFinite(options.timeout)
    ? Math.max(0, Math.trunc(options.timeout ?? DEFAULT_WAIT_TIMEOUT))
    : DEFAULT_WAIT_TIMEOUT
  const interval = Number.isFinite(options.interval)
    ? Math.max(1, Math.trunc(options.interval ?? DEFAULT_WAIT_INTERVAL))
    : DEFAULT_WAIT_INTERVAL
  const deadline = Date.now() + timeout

  while (true) {
    const result = await check()
    if (result != null) {
      return result
    }
    if (Date.now() >= deadline) {
      throw new Error(errorMessage)
    }
    await waitForDelay(interval)
  }
}
