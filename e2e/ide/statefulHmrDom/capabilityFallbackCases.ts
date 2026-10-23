export const CAPABILITY_FALLBACK_HOSTS = ['wv', 'vite', 'vite-plus'] as const
export type CapabilityFallbackHost = typeof CAPABILITY_FALLBACK_HOSTS[number]

const scenarios = [
  { requested: 'auto', reason: 'config-json' },
  { requested: 'stateful-experimental', reason: 'native-registration' },
  { requested: 'stateful-experimental', reason: 'entry-topology' },
  { requested: 'auto', reason: 'runtime-contract' },
  { requested: 'stateful-experimental', reason: 'runtime-contract' },
  { requested: 'auto', reason: 'stylesheet-output' },
  { requested: 'stateful-experimental', reason: 'stylesheet-output' },
] as const

export interface CapabilityFallbackScenario {
  requested: typeof scenarios[number]['requested']
  reason: typeof scenarios[number]['reason']
  format: 'cjs' | 'esm'
  suffix: string
}

/** 共享原有七项能力覆盖，仅在 wv 额外验证 ESM 模块格式交接。 */
export function capabilityFallbackScenarios(host: CapabilityFallbackHost): CapabilityFallbackScenario[] {
  const classic: CapabilityFallbackScenario[] = scenarios.map(scenario => ({ ...scenario, format: 'cjs', suffix: '' }))
  return host === 'wv'
    ? [...classic, { requested: 'auto', reason: 'stylesheet-output', format: 'esm', suffix: ' esm' }]
    : classic
}

export const CAPABILITY_FALLBACK_TASKS = CAPABILITY_FALLBACK_HOSTS.map(host => `ide/hmr-capability-fallback.${host}.runtime.test.ts`)
