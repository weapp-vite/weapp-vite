import path from 'node:path'

function resolveCiTest(testPath: string) {
  return path.resolve(import.meta.dirname, '..', 'ci', testPath).replaceAll('\\', '/')
}

function resolveCiTests(testPaths: string[]) {
  return testPaths.map(resolveCiTest)
}

export const HMR_GUARD_TEST_GROUPS = {
  directEntryUpdates: resolveCiTests([
    'hmr-app-shell.test.ts',
    'hmr-app-shell-initial.test.ts',
    'hmr-modify.test.ts',
    'hmr-html-template.test.ts',
    'hmr-layouts.test.ts',
    'hmr-rename.test.ts',
    'hmr-rapid.test.ts',
    'hmr-add.test.ts',
    'hmr-delete.test.ts',
    'hmr-app-config.test.ts',
    'hmr-package-scripts.test.ts',
    'skyline-hmr-fallback.test.ts',
    'hmr-platform-fallback.test.ts',
    'issue-340-comment.hmr.test.ts',
    'wevu-router-hmr.test.ts',
  ]),
  sharedDependencyPropagation: resolveCiTests([
    'hmr-layout-shared-template-wxs.test.ts',
    'hmr-shared-template-wxs.test.ts',
    'hmr-shared-runtime-deps.test.ts',
    'wevu-root-import-hmr.test.ts',
    'wevu-jsx-tsx.hmr.test.ts',
  ]),
  derivedOutputSync: resolveCiTests([
    'external-linked-vue-component.hmr.test.ts',
    'hmr-issue-1015-external-css-vars.test.ts',
    'style-import-vue.test.ts',
    'hmr-asset-ownership.test.ts',
    'hmr-profile-failed-recovery.test.ts',
    'wevu-runtime.hmr.test.ts',
    'hmr-native-batch.test.ts',
    'hmr-native-dependencies.test.ts',
  ]),
  complexDeveloperFlows: resolveCiTests([
    'e2e-app-tailwind-memory-guard.test.ts',
    'hmr-complex-developer-flow.test.ts',
    'template-tailwind-hmr.test.ts',
  ]),
} as const

export const HMR_GUARD_STABLE_TESTS = [
  ...HMR_GUARD_TEST_GROUPS.directEntryUpdates,
  ...HMR_GUARD_TEST_GROUPS.sharedDependencyPropagation,
  ...HMR_GUARD_TEST_GROUPS.derivedOutputSync,
  ...HMR_GUARD_TEST_GROUPS.complexDeveloperFlows,
]

export const HMR_GUARD_SMOKE_TESTS = resolveCiTests([
  'auto-import-vue-sfc.test.ts',
  'auto-routes-hmr.test.ts',
  'hmr-rename.test.ts',
  'hmr-rapid.test.ts',
])

export const HMR_GUARD_SPECIAL_CASES = {
  autoImportVueSfc: resolveCiTest('auto-import-vue-sfc.test.ts'),
  autoRoutesHmr: resolveCiTest('auto-routes-hmr.test.ts'),
  sharedChunksAuto: resolveCiTest('hmr-shared-chunks-auto.test.ts'),
}

export const HMR_GUARD_UTILITY_TESTS = [
  path.resolve(import.meta.dirname, '..', 'utils', 'hmr-helpers.test.ts').replaceAll('\\', '/'),
  path.resolve(import.meta.dirname, '..', 'utils', 'wevu-root-hmr-exports.test.ts').replaceAll('\\', '/'),
]

export const HMR_GUARD_ALL_TESTS = [
  ...HMR_GUARD_UTILITY_TESTS,
  ...HMR_GUARD_STABLE_TESTS,
  HMR_GUARD_SPECIAL_CASES.autoImportVueSfc,
  HMR_GUARD_SPECIAL_CASES.autoRoutesHmr,
  HMR_GUARD_SPECIAL_CASES.sharedChunksAuto,
]

export const HMR_GUARD_UTILITIES_ALREADY_RUN_OPTION = '--utilities-already-run'

export const HMR_GUARD_SUITES = {
  'full': {
    description: '稳定 HMR 护栏全集，不包含需独立运行的 auto-import-vue-sfc / auto-routes-hmr / shared-chunks-auto 特例',
    tests: HMR_GUARD_STABLE_TESTS,
  },
  'smoke': {
    description: '本地快速 HMR smoke 子集',
    tests: HMR_GUARD_SMOKE_TESTS,
  },
  'auto-import-vue-sfc': {
    description: 'auto-import Vue SFC 特例，单独运行以避免被前序 dev-watch 用例污染',
    tests: [HMR_GUARD_SPECIAL_CASES.autoImportVueSfc],
  },
  'shared-chunks-auto': {
    description: 'sharedChunks=auto 特例，需独立运行避免与其他 dev-watch 用例互相干扰',
    tests: [HMR_GUARD_SPECIAL_CASES.sharedChunksAuto],
  },
  'auto-routes-hmr': {
    description: 'auto-routes HMR 特例，需独立运行避免与其他 dev-watch 用例互相干扰',
    tests: [HMR_GUARD_SPECIAL_CASES.autoRoutesHmr],
  },
} as const

export type HmrGuardSuiteName = keyof typeof HMR_GUARD_SUITES

/** 独立入口保留工具测试；仅在父级已安排执行时显式移交这部分覆盖。 */
export function getHmrGuardTestPaths(name: HmrGuardSuiteName, options: { utilitiesAlreadyRun?: boolean } = {}) {
  return [
    ...(options.utilitiesAlreadyRun ? [] : HMR_GUARD_UTILITY_TESTS),
    ...HMR_GUARD_SUITES[name].tests,
  ]
}
