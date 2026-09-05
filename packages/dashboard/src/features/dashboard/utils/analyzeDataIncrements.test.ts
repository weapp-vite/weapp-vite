import type { AnalyzeSubpackagesResult, ModuleSourceType } from '../types'
import { describe, expect, it } from 'vitest'
import { computed } from 'vue'
import { useAnalyzeActionCenter } from '../composables/useAnalyzeActionCenter'
import { createIncrementAttribution } from './analyzeDataIncrements'
import { createPackageInsights } from './analyzeDataPackages'
import { createComparisonMaps, createModuleInfoMap } from './analyzeDataShared'
import { createTreemapModuleNodeId } from './treemap'

function createResult(modules: Array<{ id: string, source: string, bytes: number, sourceType?: ModuleSourceType }>): AnalyzeSubpackagesResult {
  return {
    packages: [
      {
        id: '__main__',
        label: '主包',
        type: 'main',
        files: [
          {
            file: 'app.js',
            type: 'chunk',
            from: 'main',
            size: 10_000,
            modules: modules.map(module => ({
              ...module,
              sourceType: module.sourceType ?? 'src',
            })),
          },
        ],
      },
    ],
    modules: modules.map(module => ({
      id: module.id,
      source: module.source,
      sourceType: module.sourceType ?? 'src',
      packages: [{ packageId: '__main__', files: ['app.js'] }],
    })),
    subPackages: [],
  }
}

describe('analyze increment attribution', () => {
  it('compares internal module variants by their canonical source path', () => {
    const previous = createResult([
      {
        id: 'v-select?old-sidecar',
        source: 'components/ui/VSelect.vue?raw&weapp-vite-sidecar-owner=%2Fproject%2Fsrc%2Fcomponents%2Fui%2FVSelect.vue',
        bytes: 4_000,
      },
    ])
    const current = createResult([
      {
        id: 'v-select?new-sidecar',
        source: 'components/ui/VSelect.vue?raw&weapp-vite-sidecar-owner=%2Fother%2Fsrc%2Fcomponents%2Fui%2FVSelect.vue',
        bytes: 5_000,
      },
      {
        id: 'v-select?using-component',
        source: 'components/ui/VSelect.vue?weapp-vite-sidecar=using-component',
        bytes: 3_500,
      },
    ])

    const items = createIncrementAttribution({
      result: current,
      previousResult: previous,
      previousMaps: createComparisonMaps(previous),
      moduleInfoMap: createModuleInfoMap(current),
    })

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      label: 'components/ui/VSelect.vue',
      previousBytes: 4_000,
      currentBytes: 5_000,
      deltaBytes: 1_000,
    })
  })

  it('matches installed and workspace copies of the same package module', () => {
    const previous = createResult([{
      id: '/workspace/packages-runtime/wevu/dist/runtime/app/context.mjs',
      source: '../../../weapp-vite/packages-runtime/wevu/dist/runtime/app/context.mjs',
      sourceType: 'workspace',
      bytes: 7_159,
    }])
    const current = createResult([{
      id: '/workspace/node_modules/wevu/dist/runtime/app/context.mjs',
      source: '../../node_modules/.pnpm/wevu@6.23.0_typescript@6.0.3/node_modules/wevu/dist/runtime/app/context.mjs',
      sourceType: 'node_modules',
      bytes: 7_254,
    }])

    const items = createIncrementAttribution({
      result: current,
      previousResult: previous,
      previousMaps: createComparisonMaps(previous),
      moduleInfoMap: createModuleInfoMap(current),
    })

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      label: 'wevu/dist/runtime/app/context.mjs',
      previousBytes: 7_159,
      currentBytes: 7_254,
      deltaBytes: 95,
    })
  })

  it('does not merge application source with a dependency sharing its display path', () => {
    const previous = createResult([{
      id: '/workspace/src/wevu/dist/runtime/app/context.mjs',
      source: 'src/wevu/dist/runtime/app/context.mjs',
      sourceType: 'src',
      bytes: 7_159,
    }])
    const current = createResult([{
      id: '/workspace/node_modules/wevu/dist/runtime/app/context.mjs',
      source: 'node_modules/wevu/dist/runtime/app/context.mjs',
      sourceType: 'node_modules',
      bytes: 7_254,
    }])

    const items = createIncrementAttribution({
      result: current,
      previousResult: previous,
      previousMaps: createComparisonMaps(previous),
      moduleInfoMap: createModuleInfoMap(current),
    })

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      label: 'wevu/dist/runtime/app/context.mjs',
      previousBytes: 0,
      currentBytes: 7_254,
      deltaBytes: 7_254,
    })
  })

  it.each([
    { sourceType: 'src', sources: ['features/editor/src/index.ts', 'features/player/src/index.ts'] },
    { sourceType: 'plugin', sources: ['plugins/editor/src/index.ts', 'plugins/player/src/index.ts'] },
    { sourceType: 'workspace', sources: ['../../editor/src/index.ts', '../../player/src/index.ts'] },
    { sourceType: 'workspace', sources: ['../shared/index.ts', '../../shared/index.ts'] },
    { sourceType: 'node_modules', sources: ['node_modules/editor/src/index.ts', 'node_modules/player/src/index.ts'] },
  ] as const)('preserves independent module growth and actions for $sourceType sources $sources', ({ sourceType, sources }) => {
    const previous = createResult([
      { id: 'editor', source: sources[0], sourceType, bytes: 1_000 },
      { id: 'player', source: sources[1], sourceType, bytes: 5_000 },
    ])
    const current = createResult([
      { id: 'editor', source: sources[0], sourceType, bytes: 1_100 },
      { id: 'player', source: sources[1], sourceType, bytes: 5_000 },
    ])
    const previousMaps = createComparisonMaps(previous)
    const items = createIncrementAttribution({
      result: current,
      previousResult: previous,
      previousMaps,
      moduleInfoMap: createModuleInfoMap(current),
    })

    expect(items).toEqual([
      expect.objectContaining({
        moduleId: 'editor',
        previousBytes: 1_000,
        currentBytes: 1_100,
        deltaBytes: 100,
      }),
    ])
    const { actionItems } = useAnalyzeActionCenter({
      budgetWarnings: computed(() => []),
      incrementAttribution: computed(() => items),
      duplicateModules: computed(() => []),
      largestFiles: computed(() => []),
      packageInsights: computed(() => createPackageInsights(current, previousMaps)),
    })
    expect(actionItems.value).toEqual([
      expect.objectContaining({
        key: 'increment:module:editor',
        kind: 'increment',
        tab: 'modules',
        moduleMeta: expect.objectContaining({
          nodeId: createTreemapModuleNodeId('__main__', 'app.js', 'editor'),
          bytes: 1_100,
        }),
      }),
    ])
  })

  it('classifies growth as informational without an explicit budget threshold', () => {
    const incrementAttribution = computed(() => [{
      key: 'module:v-select',
      label: 'components/ui/VSelect.vue',
      category: '业务源码',
      packageId: '__main__',
      packageLabel: '主包',
      file: 'app.js',
      moduleId: 'v-select',
      sourceType: 'src' as const,
      currentBytes: 5_000,
      previousBytes: 4_000,
      deltaBytes: 1_000,
      advice: '对比新增引用和共享模块。',
    }])
    const { actionItems } = useAnalyzeActionCenter({
      budgetWarnings: computed(() => []),
      incrementAttribution,
      duplicateModules: computed(() => []),
      largestFiles: computed(() => []),
      packageInsights: computed(() => []),
    })

    expect(actionItems.value).toHaveLength(1)
    expect(actionItems.value[0]?.tone).toBe('info')
  })
})
