export interface E2EResult {
  name: string
  ok: boolean
  checks: Record<string, boolean>
  details?: Record<string, any>
}

export function buildResult(
  name: string,
  checks: Record<string, boolean>,
  details?: Record<string, any>,
): E2EResult {
  const ok = Object.values(checks).every(Boolean)
  return {
    name,
    ok,
    checks,
    details,
  }
}

export function stringifyResult(result: E2EResult): string {
  return JSON.stringify(result, null, 2)
}

export function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  }
  catch {
    return String(value)
  }
}
