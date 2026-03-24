import path from 'node:path'

function resolveCiTest(testPath: string) {
  return path.resolve(import.meta.dirname, '..', 'ci', testPath).replaceAll('\\', '/')
}

export const HMR_GUARD_STABLE_TESTS = [
  'hmr-modify.test.ts',
  'hmr-html-template.test.ts',
  'hmr-layouts.test.ts',
  'hmr-rename.test.ts',
  'hmr-rapid.test.ts',
  'hmr-add.test.ts',
  'hmr-delete.test.ts',
  'hmr-app-config.test.ts',
  'issue-340-comment.hmr.test.ts',
  'auto-import-vue-sfc.test.ts',
  'wevu-runtime.hmr.test.ts',
].map(resolveCiTest)

export const HMR_GUARD_SMOKE_TESTS = [
  'auto-import-vue-sfc.test.ts',
  'auto-routes-hmr.test.ts',
  'hmr-rename.test.ts',
  'hmr-rapid.test.ts',
].map(resolveCiTest)

export const HMR_GUARD_SPECIAL_CASES = {
  autoRoutesHmr: resolveCiTest('auto-routes-hmr.test.ts'),
  sharedChunksAuto: resolveCiTest('hmr-shared-chunks-auto.test.ts'),
}

export const HMR_GUARD_ALL_TESTS = [
  ...HMR_GUARD_STABLE_TESTS,
  HMR_GUARD_SPECIAL_CASES.autoRoutesHmr,
  HMR_GUARD_SPECIAL_CASES.sharedChunksAuto,
]
