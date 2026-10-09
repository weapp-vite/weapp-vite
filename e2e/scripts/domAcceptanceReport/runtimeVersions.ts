import type { AcceptanceCaseInput, AcceptanceReport } from './types'

function completeVersion(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value === value.trim()
}

/** 不同 fixture 可以选择不同基础库；摘要仅在全部实际 SDK 相同时显示单一版本。 */
export function summarizeRuntimeVersions(cases: AcceptanceCaseInput[]) {
  const versions = new Set<string>()
  const fixtures = new Map<string, string>()
  let ideVersion: string | null = null
  for (const item of cases) {
    if (item.state === 'pending' || item.state === 'skipped') {
      continue
    }
    const runtime = item.acceptance?.runtime
    if (completeVersion(runtime?.ideVersion)) {
      ideVersion ??= runtime.ideVersion
    }
    if (completeVersion(runtime?.baseLibraryVersion) && item.acceptance) {
      versions.add(runtime.baseLibraryVersion)
      if (!fixtures.has(item.acceptance.fixture)) {
        fixtures.set(item.acceptance.fixture, runtime.baseLibraryVersion)
      }
    }
  }
  return {
    ideVersion,
    baseLibraryVersion: versions.size === 1 ? [...versions][0]! : null,
    baseLibraryVersions: Object.fromEntries(fixtures),
  }
}

/** 严格核对统一 IDE 身份、同一 fixture 的 SDK 以及报告中对应的实际版本。 */
export function evaluateRuntimeVersions(
  cases: AcceptanceCaseInput[],
  provider: AcceptanceReport['provider'],
  environment?: Pick<AcceptanceReport['environment'], 'ideVersion' | 'baseLibraryVersion' | 'baseLibraryVersions' | 'devtoolsVersionPolicy'>,
): string[] {
  if (provider !== 'devtools') {
    return []
  }
  const errors: string[] = []
  const policy = environment?.devtoolsVersionPolicy
  if (policy) {
    const officialVersionMatches = policy.selectedVersion === policy.officialVersion
    if (policy.officialVersionMatches !== officialVersionMatches) {
      errors.push('DevTools version policy has an inconsistent official version match')
    }
    if (policy.mode === 'official-stable' && (!officialVersionMatches || policy.acceptedVersion !== null)) {
      errors.push('Official Stable policy must select the official version without an accepted version override')
    }
    if (policy.mode === 'selected-version-opt-in' && policy.acceptedVersion !== policy.selectedVersion) {
      errors.push('Selected DevTools version policy does not match the accepted version')
    }
  }
  let first: NonNullable<AcceptanceCaseInput['acceptance']>['runtime']
  const fixtures = new Map<string, string>()
  for (const item of cases) {
    if (item.state === 'pending' || item.state === 'skipped') {
      continue
    }
    const runtime = item.acceptance?.runtime
    if (!completeVersion(runtime?.ideVersion) || !completeVersion(runtime?.baseLibraryVersion)) {
      errors.push(`Missing observed DevTools or base library version in ${item.id}`)
      continue
    }
    first ??= runtime
    const fixture = item.acceptance!.fixture
    const fixtureVersion = fixtures.get(fixture)
    if (runtime.ideVersion !== first.ideVersion || (fixtureVersion && runtime.baseLibraryVersion !== fixtureVersion)) {
      errors.push(`Observed runtime versions differ between cases: ${item.id}`)
    }
    if (!fixtures.has(fixture)) {
      fixtures.set(fixture, runtime.baseLibraryVersion)
    }
    const environmentSdk = environment?.baseLibraryVersions
      ? environment.baseLibraryVersions[fixture]
      : environment?.baseLibraryVersion
    if (environment && (runtime.ideVersion !== environment.ideVersion || runtime.baseLibraryVersion !== environmentSdk)) {
      errors.push(`Observed runtime versions do not match report environment: ${item.id}`)
    }
    if (policy && runtime.ideVersion !== policy.selectedVersion) {
      errors.push(`Observed DevTools version does not match selected version policy: ${item.id}`)
    }
  }
  if (environment?.baseLibraryVersions) {
    const observed = summarizeRuntimeVersions(cases)
    if (environment.baseLibraryVersion !== observed.baseLibraryVersion) {
      errors.push('Observed runtime versions do not match report environment: base library summary')
    }
    for (const fixture of Object.keys(environment.baseLibraryVersions)) {
      if (!fixtures.has(fixture)) {
        errors.push(`Report base library version has no observed fixture: ${fixture}`)
      }
    }
  }
  return errors
}
