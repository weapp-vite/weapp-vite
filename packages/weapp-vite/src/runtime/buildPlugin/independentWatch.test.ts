import { expect, it, vi } from 'vitest'
import { clearIndependentWatchFiles, collectIndependentWatchFiles } from './independentWatch'

it('retains failed dependencies and replaces them only after a successful child build', () => {
  const registry = new Map([['pkg', new Set(['old.vue'])]])
  const failed = collectIndependentWatchFiles(registry, 'pkg')
  const capture = (collector: ReturnType<typeof collectIndependentWatchFiles>, files: string[]) => {
    const hook = collector.plugin.buildEnd as (this: { getModuleIds: () => string[] }) => void
    hook.call({ getModuleIds: () => files })
  }
  capture(failed, ['new.vue', '\0virtual'])
  expect(registry.get('pkg')).toEqual(new Set(['old.vue', 'new.vue']))
  const recovered = collectIndependentWatchFiles(registry, 'pkg')
  capture(recovered, ['new.vue'])
  recovered.commit()
  expect(registry.get('pkg')).toEqual(new Set(['new.vue']))
})

it('forwards source dependencies once and preserves independent ownership', () => {
  const registry = new Map<string, Set<string>>()
  const notify = vi.fn()
  const collector = collectIndependentWatchFiles(registry, 'pkg', source => source === 'page.vue' ? ['import.wxml'] : [], new Set([notify]))
  const hook = collector.plugin.buildEnd as (this: { getModuleIds: () => string[] }) => void
  hook.call({ getModuleIds: () => ['page.vue', 'shared.ts?import'] })
  hook.call({ getModuleIds: () => ['page.vue', 'shared.ts?import'] })
  expect(notify).toHaveBeenCalledTimes(1)
  expect(registry.get('pkg')).toEqual(new Set(['page.vue', 'import.wxml', 'shared.ts']))
  collector.commit()
  expect(registry.size).toBe(1)
})

it('does not resurrect a closed registry from a pending child build', () => {
  const registry = new Map<string, Set<string>>()
  const collector = collectIndependentWatchFiles(registry, 'pkg')
  clearIndependentWatchFiles(registry)
  const hook = collector.plugin.buildEnd as (this: { getModuleIds: () => string[] }) => void
  hook.call({ getModuleIds: () => ['stale.vue'] })
  collector.commit()
  expect(registry.size).toBe(0)
  const next = collectIndependentWatchFiles(registry, 'pkg')
  next.commit()
  expect(registry.has('pkg')).toBe(true)
})
