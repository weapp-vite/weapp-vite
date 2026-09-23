import type { RuntimeSizeGuardViolation, RuntimeSizeReport } from '../runtime-size'

import { validateReport } from '../../.github/scripts/runtime-size-schema.mjs'
import { RUNTIME_SIZE_REPORT_VERSION, runtimeSizeBudgets, runtimeSizeDenyRules } from '../runtime-size-config'
import { compareStrings, normalizePosixPath, resolveRuntimeImportChain } from './modules'

function moduleMatchesSuffix(modulePath: string, suffix: string) {
  const normalizedSuffix = normalizePosixPath(suffix)
  return modulePath === normalizedSuffix.replace(/^\//u, '') || modulePath.endsWith(normalizedSuffix)
}

export function collectRuntimeSizeGuardViolations(report: RuntimeSizeReport): RuntimeSizeGuardViolation[] {
  validateReport(report, 'report', RUNTIME_SIZE_REPORT_VERSION)
  const violations: RuntimeSizeGuardViolation[] = []

  for (const budget of runtimeSizeBudgets) {
    const target = report.targets.find(candidate => candidate.id === budget.target)
    const tier = target?.tiers.find(candidate => candidate.id === budget.tier)
    if (tier && tier.production.bytes > budget.ceilingBytes) {
      violations.push({
        kind: 'budget',
        target: budget.target,
        tier: budget.tier,
        mode: budget.mode,
        actualBytes: tier.production.bytes,
        ceilingBytes: budget.ceilingBytes,
      })
    }
  }

  for (const target of report.targets) {
    for (const tier of target.tiers) {
      for (const module of tier.production.retainedModules.modules) {
        const optionalCapability = tier.id !== 'full-provider' && (
          /packages-runtime\/wevu\/dist\/router\/(?:initialNavigation|instance)\.mjs$/u.test(module.path)
          || /(?:^|\/)@weapp-core\/api\/dist\//u.test(module.path)
          || /packages-runtime\/(?:wevu|web-apis)\/dist\/fetch(?:\.mjs|\/)/u.test(module.path)
        )
        const unusedJsx = !tier.id.startsWith('public-') && tier.id !== 'full-provider'
          && /\/runtime\/(?:jsxIsland|features\/jsxIslands)\.mjs$/u.test(module.path)
        const foreignAdapter = target.id !== 'alipay' && module.path.endsWith('/runtime/register/component/alipayRegistration.mjs')
        const genericPlatform = module.path.endsWith('/runtime/platform/generic.mjs')
        const sharedBuildMetadata = /(?:^|\/)@weapp-core\/shared\/dist\/platforms(?:\/(?!runtime\/)|(?:-[^/]+)?\.m?js$)/u.test(module.path)
        if (module.bytesInOutput > 0 && (optionalCapability || unusedJsx || foreignAdapter || genericPlatform || sharedBuildMetadata)) {
          violations.push({
            kind: 'retained-module',
            target: target.id,
            tier: tier.id,
            mode: 'production',
            modulePath: module.path,
            bytesInOutput: module.bytesInOutput,
            importChain: resolveRuntimeImportChain(tier.production.retainedModules, module.path),
          })
        }
      }
    }
  }

  for (const rule of runtimeSizeDenyRules) {
    const target = report.targets.find(candidate => candidate.id === rule.target)
    if (!target) {
      continue
    }
    for (const tier of target.tiers) {
      if (rule.allowedTiers.includes(tier.id)) {
        continue
      }
      for (const module of tier.production.retainedModules.modules) {
        if (module.bytesInOutput <= 0 || !moduleMatchesSuffix(module.path, rule.suffix)) {
          continue
        }
        violations.push({
          kind: 'retained-module',
          target: target.id,
          tier: tier.id,
          mode: rule.mode,
          modulePath: module.path,
          bytesInOutput: module.bytesInOutput,
          importChain: resolveRuntimeImportChain(tier.production.retainedModules, module.path),
        })
      }
    }
  }

  return violations.sort((left, right) => {
    const leftKey = `${left.target}\0${left.tier}\0${left.mode}\0${left.kind === 'budget' ? '0' : `1${left.modulePath}`}`
    const rightKey = `${right.target}\0${right.tier}\0${right.mode}\0${right.kind === 'budget' ? '0' : `1${right.modulePath}`}`
    return compareStrings(leftKey, rightKey)
  })
}

export function formatRuntimeSizeGuardError(violations: readonly RuntimeSizeGuardViolation[]) {
  return [
    `Runtime size guard failed with ${violations.length} violation(s):`,
    ...violations.map((violation) => {
      const scope = `target=${violation.target} tier=${violation.tier} mode=${violation.mode}`
      if (violation.kind === 'budget') {
        return `- ${scope}: actual=${violation.actualBytes} B ceiling=${violation.ceilingBytes} B.`
      }
      return `- ${scope}: retained denied module=${violation.modulePath} bytes=${violation.bytesInOutput} B chain=${violation.importChain.join(' -> ')}.`
    }),
  ].join('\n')
}

export function assertRuntimeSizeReport(report: RuntimeSizeReport) {
  const violations = collectRuntimeSizeGuardViolations(report)
  if (violations.length > 0) {
    throw new Error(formatRuntimeSizeGuardError(violations))
  }
}
