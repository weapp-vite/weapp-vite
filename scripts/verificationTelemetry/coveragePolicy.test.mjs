import { expect, it } from 'vitest'
import { classifyCoverageScope, coverageScopePolicy } from './coveragePolicy.mjs'

it('retains full explicit validation inventories while keeping unknown and runtime tests in the product scope', () => {
  const scope = classifyCoverageScope({ files: ['packages/runtime/test.ts', 'scripts/unknown.test.ts', 'scripts/verification/plan.test.ts'], cases: [['packages/runtime/test.ts', 'works', 'passed'], ['scripts/unknown.test.ts', 'works', 'skipped'], ['scripts/verification/plan.test.ts', 'tooling', 'passed']] })
  expect(scope.product.cases).toHaveLength(2)
  expect(scope.validation.cases).toEqual([['scripts/verification/plan.test.ts', 'tooling', 'passed']])
  expect(scope.classification).toContainEqual({ file: 'scripts/unknown.test.ts', category: 'product', rule: null })
  expect(scope.classification).toContainEqual({ file: 'scripts/verification/plan.test.ts', category: 'validation', rule: 'scripts/verification/' })
  expect(() => classifyCoverageScope({ files: [], cases: [] }, { ...coverageScopePolicy, validationDirectories: ['packages/'] })).toThrow(/policy/)
})

it('does not classify new simulator runtime regressions as validation tooling', () => {
  const file = 'mpcore/packages/simulator/test/tdesignStyleBindings.test.ts'
  const scope = classifyCoverageScope({ files: [file], cases: [[file, 'native class/style', 'passed']] })
  expect(scope.product.files).toEqual([file])
  expect(scope.validation.files).toEqual([])
})

it.each([
  ['CI evidence', ['build-artifact-manifest', 'ci-timing', 'ci-topology', 'ci-types', 'verification-history']],
  ['approval and reports', ['manual-pr-actions', 'native-pr-actions', 'native-pr-report-source', 'native-pr-report', 'pr-context-provenance', 'pr-context', 'pr-resource-policy', 'pr-status-history', 'publish-pr-status']],
  ['checkout and installation diagnostics', ['git-index-lock-doctor', 'hostCapabilityDiagnostic', 'print-rolldown-versions-at-install-tail', 'print-rolldown-versions']],
  ['benchmark capture', ['verification-benchmark-capture', 'verification-benchmark-ci', 'verification-benchmark-evidence', 'verification-benchmark']],
  ['bounded tooling modules', ['consumerArtifacts/manifest', 'nativeAddonCorrectness/addon', 'nativeAddonCorrectness/manifest', 'nativeAddonCorrectness/runner', 'pnpmLockfile/index', 'prAdmission/cli', 'prAdmission/live', 'prAdmission/local', 'provider-consumer-cost/cost', 'verify-native-addon-correctness']],
])('retains individually audited %s MJS tests with exact file classification receipts', (_, names) => {
  for (const name of names) {
    const file = `scripts/${name}.test.mjs`
    const scope = classifyCoverageScope({ files: [file], cases: [[file, 'actual tooling case', 'passed']] })
    expect(scope.validation.cases).toEqual([[file, 'actual tooling case', 'passed']])
    expect(scope.classification).toEqual([{ file, category: 'validation', rule: file }])
  }
})

it('keeps unreviewed MJS scripts and package behavior tests as product instead of excluding every script', () => {
  const files = ['scripts/new-product.test.mjs', 'scripts/nativeAddonCorrectness/new-product.test.mjs', 'packages/weapp-vite/test/runtime.test.mjs']
  const scope = classifyCoverageScope({ files, cases: files.map(file => [file, 'product behavior', 'passed']) })
  expect(scope.product.files).toEqual(files)
  expect(scope.validation.files).toEqual([])
  expect(scope.classification.every(entry => entry.rule === null)).toBe(true)
  expect(coverageScopePolicy.validationDirectories).not.toContain('scripts/')
})
