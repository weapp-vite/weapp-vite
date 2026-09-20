import type { AcceptanceCaseInput, AcceptanceReport } from './types'

function completeVersion(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value === value.trim()
}

/** 严格验收只接受实际会话版本，并要求所有 case 与报告摘要一致。 */
export function evaluateRuntimeVersions(
  cases: AcceptanceCaseInput[],
  provider: AcceptanceReport['provider'],
  environment?: Pick<AcceptanceReport['environment'], 'ideVersion' | 'baseLibraryVersion'>,
): string[] {
  if (provider !== 'devtools') {
    return []
  }
  const errors: string[] = []
  let first: NonNullable<AcceptanceCaseInput['acceptance']>['runtime']
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
    if (runtime.ideVersion !== first.ideVersion || runtime.baseLibraryVersion !== first.baseLibraryVersion) {
      errors.push(`Observed runtime versions differ between cases: ${item.id}`)
    }
    if (environment && (runtime.ideVersion !== environment.ideVersion || runtime.baseLibraryVersion !== environment.baseLibraryVersion)) {
      errors.push(`Observed runtime versions do not match report environment: ${item.id}`)
    }
  }
  return errors
}
