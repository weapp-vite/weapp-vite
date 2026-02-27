import process from 'node:process'

const DEFAULT_E2E_MAX_WORKERS = 1

export function resolveE2EMaxWorkers(defaultValue = DEFAULT_E2E_MAX_WORKERS) {
  const raw = process.env.WEAPP_VITE_E2E_MAX_WORKERS
  if (!raw) {
    return defaultValue
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return defaultValue
  }

  return parsed
}
