import type { VueCompilationCacheEntry } from './types'
import { describe, expect, it } from 'vitest'
import { createModuleGraphService } from '../../../../../moduleGraph'
import { invalidateExternalSfcCompilation } from './externalDependencies'

function compiled(dependencies: string[]): VueCompilationCacheEntry {
  return {
    result: { meta: { sfcSrcCompilationDeps: dependencies, sfcSrcDeps: [...dependencies, '/src/theme.css'] } },
    source: '<template src="./template.html"/><script setup src="./setup.ts"/>',
    styleIndependentSignature: 'original',
    isPage: false,
  }
}

describe('external SFC compilation dependencies', () => {
  it.each(['/src/template.html', '/src/setup.ts'])('invalidates all owners after %s changes or is removed', (file) => {
    const first = compiled([file])
    const second = compiled([file])
    const unrelated = compiled(['/src/other.ts'])
    const cache = new Map([['/src/first.vue', first], ['/src/second.vue', second], ['/src/other.vue', unrelated]])
    const graph = createModuleGraphService()
    for (const [owner, entry] of cache) {
      graph.replaceEntryDependencies(owner, 'script', entry.result.meta!.sfcSrcCompilationDeps!)
    }
    invalidateExternalSfcCompilation(file, cache, graph)
    expect(first.source).toBeUndefined()
    expect(first.styleIndependentSignature).toBeUndefined()
    expect(second.source).toBeUndefined()
    expect(unrelated.source).toBeDefined()
    expect(unrelated.styleIndependentSignature).toBe('original')
  })

  it('keeps external styles on the style refresh path', () => {
    const entry = compiled(['/src/setup.ts'])
    const graph = createModuleGraphService()
    graph.replaceEntryDependencies('/src/component.vue', 'script', ['/src/setup.ts'])
    graph.replaceEntryDependencies('/src/component.vue', 'style', ['/src/theme.css'])
    invalidateExternalSfcCompilation('/src/theme.css', new Map([['/src/component.vue', entry]]), graph)
    expect(entry.source).toBeDefined()
    expect(entry.styleIndependentSignature).toBe('original')
  })

  it('normalizes dependencies and follows the latest compiled owner graph', () => {
    const entry = compiled(['D:\\src\\setup.ts'])
    const cache = new Map([['D:/src/component.vue', entry]])
    const graph = createModuleGraphService()
    graph.replaceEntryDependencies('D:/src/component.vue', 'script', entry.result.meta!.sfcSrcCompilationDeps!)
    invalidateExternalSfcCompilation('D:/src/setup.ts', cache, graph)
    expect(entry.source).toBeUndefined()
    const replacement = compiled(['D:/src/replacement.ts'])
    cache.set('D:/src/component.vue', replacement)
    graph.replaceEntryDependencies('D:/src/component.vue', 'script', replacement.result.meta!.sfcSrcCompilationDeps!)
    invalidateExternalSfcCompilation('D:/src/setup.ts', cache, graph)
    expect(replacement.source).toBeDefined()
    invalidateExternalSfcCompilation('D:/src/replacement.ts', cache, graph)
    expect(replacement.source).toBeUndefined()
  })
})
