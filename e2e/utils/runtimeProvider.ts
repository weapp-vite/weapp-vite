import process from 'node:process'

export const E2E_RUNTIME_PROVIDER_ENV = 'WEAPP_VITE_E2E_RUNTIME_PROVIDER'

export type RuntimeProviderName = 'devtools' | 'headless'

const DEFAULT_RUNTIME_PROVIDER: RuntimeProviderName = 'devtools'

function isRuntimeProviderName(value: string): value is RuntimeProviderName {
  return value === 'devtools' || value === 'headless'
}

export function resolveRuntimeProviderName(raw = process.env[E2E_RUNTIME_PROVIDER_ENV]): RuntimeProviderName {
  const normalized = raw?.trim().toLowerCase()
  if (!normalized) {
    return DEFAULT_RUNTIME_PROVIDER
  }
  if (isRuntimeProviderName(normalized)) {
    return normalized
  }
  throw new Error(
    `Unsupported e2e runtime provider "${raw}". Expected one of: devtools, headless. `
    + `Use ${E2E_RUNTIME_PROVIDER_ENV}=devtools|headless.`,
  )
}

export function assertRuntimeProviderImplemented(provider: RuntimeProviderName) {
  switch (provider) {
    case 'devtools':
    case 'headless':
      return
    default: {
      const exhaustiveCheck: never = provider
      return exhaustiveCheck
    }
  }
}

export function describeRuntimeProviderSelection(raw = process.env[E2E_RUNTIME_PROVIDER_ENV]) {
  const provider = resolveRuntimeProviderName(raw)
  return {
    envName: E2E_RUNTIME_PROVIDER_ENV,
    provider,
    source: raw?.trim() ? 'env' : 'default',
  } as const
}
