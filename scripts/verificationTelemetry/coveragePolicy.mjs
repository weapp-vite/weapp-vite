import assert from 'node:assert/strict'

// 仅列出验证基础设施自身的回归；未知文件默认属于产品范围，不能自动排除。
export const coverageScopePolicy = {
  version: 'verification-case-classification-v1',
  validationDirectories: ['scripts/verification/', 'scripts/verificationE2E/', 'scripts/verificationTelemetry/', 'scripts/verificationBenchmark/', 'scripts/coverageShards/'],
  validationFiles: [
    // 逐文件审计 root 新发现的 MJS：只覆盖验证、证据、安装诊断和仓库维护工具。
    'scripts/build-artifact-manifest.test.mjs',
    'scripts/ci-timing.test.mjs',
    'scripts/ci-topology.test.mjs',
    'scripts/ci-types.test.mjs',
    'scripts/consumerArtifacts/manifest.test.mjs',
    'scripts/git-index-lock-doctor.test.mjs',
    'scripts/hostCapabilityDiagnostic.test.mjs',
    'scripts/manual-pr-actions.test.mjs',
    'scripts/native-pr-actions.test.mjs',
    'scripts/native-pr-report-source.test.mjs',
    'scripts/native-pr-report.test.mjs',
    'scripts/nativeAddonCorrectness/addon.test.mjs',
    'scripts/nativeAddonCorrectness/manifest.test.mjs',
    'scripts/nativeAddonCorrectness/runner.test.mjs',
    'scripts/pnpmLockfile/index.test.mjs',
    'scripts/pr-context-provenance.test.mjs',
    'scripts/pr-context.test.mjs',
    'scripts/pr-resource-policy.test.mjs',
    'scripts/pr-status-history.test.mjs',
    'scripts/prAdmission/cli.test.mjs',
    'scripts/prAdmission/live.test.mjs',
    'scripts/prAdmission/local.test.mjs',
    'scripts/print-rolldown-versions-at-install-tail.test.mjs',
    'scripts/print-rolldown-versions.test.mjs',
    'scripts/provider-consumer-cost/cost.test.mjs',
    'scripts/publish-pr-status.test.mjs',
    'scripts/verification-benchmark-capture.test.mjs',
    'scripts/verification-benchmark-ci.test.mjs',
    'scripts/verification-benchmark-evidence.test.mjs',
    'scripts/verification-benchmark.test.mjs',
    'scripts/verification-history.test.mjs',
    'scripts/verify-native-addon-correctness.test.mjs',
    'scripts/bun-ci.test.ts',
    'scripts/ci-artifact-coverage.test.ts',
    'scripts/ci-e2e-project-scope.test.ts',
    'scripts/e2e-diagnostic-workflow.test.ts',
    'scripts/public-type-test-coverage.test.ts',
    'scripts/simulator-browser-coverage.test.ts',
    'scripts/turbo-cache-contract.test.ts',
    'scripts/vitest-checkout-isolation.test.ts',
    'scripts/vitest-project-partition.test.ts',
    'packages/weapp-vite/test/utils/fixtureIsolation.test.ts',
    'e2e/scripts/domAcceptanceReport/reporter.test.ts',
    'e2e/scripts/domAcceptanceReport/suite.test.ts',
    'e2e/scripts/e2e-suite-manifest.test.ts',
    'e2e/scripts/suiteRunner.test.ts',
    'e2e/utils/domAcceptance/consoleBoundary.test.ts',
  ],
}

/** 完整执行先校验，再给每个文件留下显式分类凭据；产品集合与工具集合均保留。 */
export function classifyCoverageScope(scope, policy = coverageScopePolicy) {
  assert.deepEqual(policy, coverageScopePolicy, 'Unknown or modified coverage classification policy')
  const classification = scope.files.map((file) => {
    const rule = policy.validationFiles.find(value => value === file) ?? policy.validationDirectories.find(value => file.startsWith(value)) ?? null
    return { file, category: rule ? 'validation' : 'product', rule }
  })
  const files = category => classification.filter(entry => entry.category === category).map(entry => entry.file)
  const productFiles = files('product')
  const validationFiles = files('validation')
  return {
    policy,
    product: { files: productFiles, cases: scope.cases.filter(([file]) => productFiles.includes(file)) },
    validation: { files: validationFiles, cases: scope.cases.filter(([file]) => validationFiles.includes(file)) },
    classification,
  }
}
