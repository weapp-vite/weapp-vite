import type { EffectScope } from 'vue'
import type { AnalyzeSubpackagesResult, PackageFileEntry, TreemapFileNodeMeta, TreemapNodeMeta } from '../types'
import { afterEach, describe, expect, it } from 'vitest'
import { computed, effectScope, nextTick, shallowRef } from 'vue'
import { createTreemapFileNodeId, createTreemapPackageNodeId } from '../utils/treemap'
import { createTreemapDetailReport, formatDetailBytes } from '../utils/treemapDetails/context'
import { createTreemapImportIndex } from '../utils/treemapDetails/references'
import { createModuleTreemapNode } from '../utils/treemapNodeFactories'
import { useTreemapDetailSections } from './useTreemapDetailSections'

function createResult(): AnalyzeSubpackagesResult {
  return {
    packages: [{
      id: '__main__',
      label: '主包',
      type: 'main',
      files: [
        { file: 'app.js', type: 'chunk', from: 'main', size: 4096, imports: ['./shared.js'], dynamicImports: ['./lazy.js'], modules: [
          { id: 'app', source: 'src/app.ts', sourceType: 'src', bytes: 4096 },
          { id: 'helper', source: 'src/helper.ts', sourceType: 'src', bytes: 512 },
        ] },
        { file: 'shared.js', type: 'chunk', from: 'main', size: 4096 },
        { file: 'lazy.js', type: 'chunk', from: 'main', size: 4096 },
        { file: 'entry.js', type: 'chunk', from: 'main', size: 4096, imports: ['./app.js'] },
        { file: 'route.js', type: 'chunk', from: 'main', size: 4096, dynamicImports: ['./app.js'] },
        { file: 'unknown.js', type: 'chunk', from: 'main' },
      ],
    }, {
      id: 'other',
      label: '其他包',
      type: 'subPackage',
      files: [
        { file: 'copy.js', type: 'chunk', from: 'main', size: 4096 },
        { file: 'unrelated.js', type: 'chunk', from: 'main', size: 128 },
      ],
    }],
    modules: [{ id: 'app', source: 'src/app.ts', sourceType: 'src', packages: [
      { packageId: '__main__', files: ['app.js'] },
      { packageId: 'other', files: ['copy.js'] },
    ] }],
    subPackages: [],
  }
}

function file(result: AnalyzeSubpackagesResult, name: string): PackageFileEntry {
  return result.packages.flatMap(pkg => pkg.files).find(entry => entry.file === name)!
}

function fileMeta(fileName = 'app.js'): TreemapFileNodeMeta {
  return {
    kind: 'file',
    nodeId: createTreemapFileNodeId('__main__', fileName),
    packageId: '__main__',
    packageLabel: '主包',
    fileName,
    type: 'chunk',
    from: 'main',
    childCount: 2,
  }
}

const scopes: EffectScope[] = []

afterEach(() => {
  for (const scope of scopes.splice(0)) {
    scope.stop()
  }
})

function setup(meta: TreemapNodeMeta | null = fileMeta(), initial = createResult()) {
  const result = shallowRef(initial)
  const selectedMeta = shallowRef(meta)
  const scope = effectScope()
  scopes.push(scope)
  const state = scope.run(() => {
    const report = computed(() => createTreemapDetailReport(result.value))
    const imports = computed(() => createTreemapImportIndex(report.value))
    return useTreemapDetailSections({
      report: () => report.value,
      imports: () => imports.value,
      selectedMeta: () => selectedMeta.value,
    })
  })!
  async function update(change: (next: AnalyzeSubpackagesResult) => void) {
    const next = structuredClone(result.value)
    change(next)
    result.value = next
    await nextTick()
  }
  return { result, selectedMeta, state, update }
}

describe('treemap detail section state', () => {
  it('marks a closed related group for raw byte changes and keeps it unread until opened', async () => {
    const { state, update } = setup()
    const unread = computed(() => state.hasUnread('children'))
    state.setOpen('children', false)
    state.setOpen('outgoing-static', false)
    expect(formatDetailBytes(4096)).toBe(formatDetailBytes(4097))
    await update((next) => {
      file(next, 'app.js').modules![0]!.bytes = 4097
    })
    expect(unread.value).toBe(true)
    expect(state.hasUnread('outgoing-static')).toBe(false)
    await update((next) => {
      file(next, 'app.js').modules![0]!.bytes = 4096
    })
    expect(unread.value).toBe(true)
    state.setOpen('children', true)
    expect(unread.value).toBe(false)
    state.setOpen('children', false)
    await update((next) => {
      file(next, 'app.js').gzipSize = 50
    })
    expect(unread.value).toBe(false)
  })

  it('ignores report clones, ordering, unrelated changes and presentation-only metadata', async () => {
    const { result, selectedMeta, state, update } = setup()
    state.setOpen('children', false)
    state.setOpen('outgoing-static', false)
    result.value = structuredClone(result.value)
    await nextTick()
    expect(state.isOpen('children')).toBe(false)
    expect(state.hasUnread('children')).toBe(false)
    expect(state.hasUnread('outgoing-static')).toBe(false)
    await update((next) => {
      next.packages.reverse()
      file(next, 'app.js').modules!.reverse()
      file(next, 'unrelated.js').size = 8192
      next.modules.push({ id: 'unrelated', source: 'src/other.ts', sourceType: 'src', packages: [] })
      next.subPackages.push({ root: 'new-package', independent: false })
    })
    selectedMeta.value = { ...fileMeta(), childCount: 0, bytes: 1, colorLabel: '重复模块', deltaBytes: 100 }
    await nextTick()
    expect(state.isOpen('children')).toBe(false)
    expect(state.hasUnread('children')).toBe(false)
    expect(state.hasUnread('outgoing-static')).toBe(false)
  })

  it.each([
    ['outgoing-static', 'shared.js'],
    ['outgoing-dynamic', 'lazy.js'],
    ['incoming-static', 'entry.js'],
    ['incoming-dynamic', 'route.js'],
  ])('tracks only the affected reference group %s', async (changedGroup, changedFile) => {
    const { state, update } = setup()
    const groups = ['children', 'outgoing-static', 'outgoing-dynamic', 'incoming-static', 'incoming-dynamic']
    for (const group of groups) {
      state.setOpen(group, false)
    }
    await update((next) => {
      file(next, changedFile).size = 4097
    })
    for (const group of groups) {
      expect(state.hasUnread(group)).toBe(group === changedGroup)
    }
  })

  it('does not mark open groups and resets state instead of caching previous selections', async () => {
    const { state, selectedMeta, update } = setup()
    await update((next) => {
      file(next, 'app.js').modules![0]!.bytes = 4097
    })
    expect(state.hasUnread('children')).toBe(false)
    state.setOpen('children', false)
    await update((next) => {
      file(next, 'app.js').modules![0]!.bytes = 4098
    })
    expect(state.hasUnread('children')).toBe(true)
    selectedMeta.value = fileMeta('shared.js')
    await nextTick()
    expect(state.isOpen('children')).toBe(true)
    expect(state.hasUnread('children')).toBe(false)
    selectedMeta.value = fileMeta()
    await nextTick()
    expect(state.isOpen('children')).toBe(true)
    expect(state.hasUnread('children')).toBe(false)
    selectedMeta.value = null
    await nextTick()
    expect(state.isOpen('children')).toBe(true)
    expect(state.hasUnread('children')).toBe(false)
  })

  it('keeps vanished groups unread on return and initializes newly available groups as open', async () => {
    const initial = createResult()
    file(initial, 'app.js').type = 'asset'
    const { state, update } = setup(fileMeta(), initial)
    state.setOpen('children', false)
    await update((next) => {
      file(next, 'app.js').type = 'chunk'
    })
    expect(state.isOpen('outgoing-static')).toBe(true)
    expect(state.hasUnread('outgoing-static')).toBe(false)
    expect(state.hasUnread('children')).toBe(true)
    state.setOpen('outgoing-static', false)
    await update((next) => {
      file(next, 'app.js').type = 'asset'
    })
    expect(state.hasUnread('outgoing-static')).toBe(true)
    await update((next) => {
      file(next, 'app.js').type = 'chunk'
    })
    expect(state.isOpen('outgoing-static')).toBe(false)
    expect(state.hasUnread('outgoing-static')).toBe(true)
    state.setOpen('outgoing-static', true)
    expect(state.hasUnread('outgoing-static')).toBe(false)
  })

  it('tracks complete module placements and treats a missing selected module as an empty group', async () => {
    const initial = createResult()
    const module = file(initial, 'app.js').modules![0]!
    const meta = createModuleTreemapNode('__main__', '主包', 'app.js', new Map(), module).meta
    const { state, update } = setup(meta, initial)
    state.setOpen('locations', false)
    await update((next) => {
      file(next, 'unrelated.js').size = 8192
    })
    expect(state.hasUnread('locations')).toBe(false)
    await update((next) => {
      file(next, 'copy.js').size = 4097
    })
    expect(state.hasUnread('locations')).toBe(true)
    state.setOpen('locations', true)
    state.setOpen('locations', false)
    await update((next) => {
      file(next, 'app.js').modules = []
    })
    expect(state.hasUnread('locations')).toBe(true)
    await update((next) => {
      file(next, 'app.js').modules = [module]
    })
    expect(state.hasUnread('locations')).toBe(true)
  })

  it.each(['root', 'package'] as const)('tracks exact known bytes in %s children despite missing file sizes', async (kind) => {
    const meta: TreemapNodeMeta | null = kind === 'root'
      ? null
      : {
          kind: 'package',
          nodeId: createTreemapPackageNodeId('__main__'),
          packageId: '__main__',
          packageLabel: '主包',
          packageType: 'main',
          fileCount: 6,
        }
    const { state, update } = setup(meta)
    state.setOpen('children', false)
    await update((next) => {
      file(next, 'app.js').size = 4097
    })
    expect(state.hasUnread('children')).toBe(true)
  })
})
