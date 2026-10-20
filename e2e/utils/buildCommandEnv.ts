import process from 'node:process'

const BUILD_ENV_STRIP_PREFIXES = [
  'npm_lifecycle_',
  'npm_package_',
]

const BUILD_ENV_STRIP_KEYS = new Set([
  'PNPM_PACKAGE_NAME',
  'PNPM_SCRIPT_SRC_DIR',
  'NODE_ENV',
  'TEST',
  'VITEST',
  'VITEST_MODE',
  'VITEST_POOL_ID',
  'VITEST_WORKER_ID',
  'WEAPP_VITE_E2E_TARGET_FILE',
])

export function sanitizeBuildCommandEnv(env = process.env) {
  const nextEnv: Record<string, string> = {}

  for (const [key, value] of Object.entries(env)) {
    if (typeof value !== 'string') {
      continue
    }
    if (BUILD_ENV_STRIP_KEYS.has(key)) {
      continue
    }
    if (BUILD_ENV_STRIP_PREFIXES.some(prefix => key.startsWith(prefix))) {
      continue
    }
    nextEnv[key] = value
  }

  return nextEnv
}
