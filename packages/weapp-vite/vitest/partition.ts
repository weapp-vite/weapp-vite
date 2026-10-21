/** fixture 目录默认串行，只有完成隔离审计的文件才能进入并行分区。 */
export const serialFixtureTestIncludes = [
  'test/**/*.test.ts',
  'test/**/*.spec.ts',
]

/** 已审核为内存内转换或各自临时目录的用例；共享 fixture 与 watch 用例继续串行。 */
export const parallelFixtureTests = [
  'test/auto-import.test.ts',
  'test/utils/fixtureIsolation.test.ts',
  'test/vue/advanced.test.ts',
  'test/vue/class-style-runtime.test.ts',
  'test/vue/compiler.test.ts',
  'test/vue/component-json.test.ts',
  'test/vue/emit-assets.test.ts',
  'test/vue/json-macros-strip.test.ts',
  'test/vue/native-page-layout.test.ts',
  'test/vue/resolver.installation.test.ts',
  'test/vue/runtime-export.test.ts',
  'test/vue/script-setup-define-model.test.ts',
  'test/vue/script-setup-define-props-emits.test.ts',
  'test/vue/sfc-integration.test.ts',
]

/** 从完整发现范围推导并行分区，新增发现目录无需维护第二份目录白名单。 */
export function createFastTestIncludes(projectTestIncludes: readonly string[]): string[] {
  return [
    ...projectTestIncludes.filter(pattern => !serialFixtureTestIncludes.includes(pattern)),
    ...parallelFixtureTests,
  ]
}
