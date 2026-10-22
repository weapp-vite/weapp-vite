import { expect, it } from 'vitest'
import { beginHmrStyleUpdatePlan, clearPendingHmrStyleUpdates, createHmrStyleUpdatePlan, getHmrStyleUpdatePlan, mergeHmrStyleUpdatePlan, recordHmrStyleUpdate, settleHmrStyleUpdatePlan, withHmrStyleUpdatePlan } from './hmrStyleUpdate'

it('keeps saves arriving during the current generation pending for the next build', () => {
  const config = {}
  recordHmrStyleUpdate(config, '/src/page.vue', { compilerContentOwners: [['/src/app.vue', 'tailwind-content']] })
  const release = beginHmrStyleUpdatePlan(config, ['/src/page.vue'])
  const current = getHmrStyleUpdatePlan(config)!
  expect(current.compilerContentOwners.get('/src/app.vue')).toBe('tailwind-content')
  recordHmrStyleUpdate(config, '/src/theme.scss')
  expect(current.sourceFiles.has('/src/theme.scss')).toBe(false)
  release()
  const releaseNext = beginHmrStyleUpdatePlan(config, [])
  const next = getHmrStyleUpdatePlan(config)!
  expect(next.id).not.toBe(current.id)
  expect(next.sourceFiles).toEqual(new Set(['/src/theme.scss']))
  expect(next.styleFiles).toEqual(new Set(['/src/theme.scss']))
  expect(next.compilerContentOwners.size).toBe(0)
  release()
  expect(getHmrStyleUpdatePlan(config)).toBe(next)
  releaseNext()
  releaseNext()
  expect(getHmrStyleUpdatePlan(config)).toBeUndefined()
})

it('preserves a scoped snapshot through nested native hooks and releases it after failure', async () => {
  const config = {}
  const plan = createHmrStyleUpdatePlan(['/src/page.vue'], { compilerContentOwners: [['/src/app.vue', 'compiler-content']] })
  await expect(withHmrStyleUpdatePlan(config, plan, async () => {
    const release = beginHmrStyleUpdatePlan(config, ['/src/other.css'])
    mergeHmrStyleUpdatePlan(config, { cssImporterOwners: ['/src/page.vue'] })
    release()
    expect(getHmrStyleUpdatePlan(config)).toBe(plan)
    expect(plan.cssImporterOwners).toEqual(new Set(['/src/page.vue']))
    recordHmrStyleUpdate(config, '/src/next.css')
    throw new Error('native write failed')
  })).rejects.toThrow('native write failed')
  expect(getHmrStyleUpdatePlan(config)).toBeUndefined()
  const release = beginHmrStyleUpdatePlan(config, [])
  expect(getHmrStyleUpdatePlan(config)!.sourceFiles).toEqual(new Set(['/src/next.css', '/src/page.vue']))
  expect(getHmrStyleUpdatePlan(config)!.compilerContentOwners.get('/src/app.vue')).toBe('compiler-content')
  release()
})

it('retries failed watch delivery facts once even when the next edit changes only a handler', () => {
  const config = {}
  recordHmrStyleUpdate(config, '/src/page.vue', { compilerContentOwners: [['/src/app.vue', 'tailwind-content']] })
  const release = beginHmrStyleUpdatePlan(config, ['/src/page.vue'])
  release(false)
  recordHmrStyleUpdate(config, '/src/page.vue')
  const retry = beginHmrStyleUpdatePlan(config, ['/src/page.vue'])
  expect(getHmrStyleUpdatePlan(config)!.compilerContentOwners.get('/src/app.vue')).toBe('tailwind-content')
  retry()
  const next = beginHmrStyleUpdatePlan(config, ['/src/page.vue'])
  expect(getHmrStyleUpdatePlan(config)!.compilerContentOwners.size).toBe(0)
  next()
})

it.each(['watch', 'snapshot'] as const)('retains an initial full failure without source files until successful retry (%s)', async (kind) => {
  const config = {}
  if (kind === 'watch') {
    beginHmrStyleUpdatePlan(config, [], true)(false)
  }
  else {
    await expect(withHmrStyleUpdatePlan(config, createHmrStyleUpdatePlan([], { full: true }), async () => {
      throw new Error('initial write failed')
    })).rejects.toThrow('initial write failed')
  }
  const retry = beginHmrStyleUpdatePlan(config, ['/src/page.vue'])
  expect(getHmrStyleUpdatePlan(config)!.full).toBe(true)
  retry()
  const next = beginHmrStyleUpdatePlan(config, ['/src/page.vue'])
  expect(getHmrStyleUpdatePlan(config)!.full).toBe(false)
  next()
})

it('keeps newer pending facts and rejects an old generation settlement', () => {
  const config = {}
  recordHmrStyleUpdate(config, '/src/page.vue', { compilerContentOwners: [['/src/app.vue', 'tailwind-content']] })
  const release = beginHmrStyleUpdatePlan(config, ['/src/page.vue'])
  const old = getHmrStyleUpdatePlan(config)
  recordHmrStyleUpdate(config, '/src/page.vue', { compilerContentOwners: [['/src/app.vue', 'compiler-content']] })
  release(false)
  const next = beginHmrStyleUpdatePlan(config, ['/src/page.vue'])
  const current = getHmrStyleUpdatePlan(config)
  expect(current!.compilerContentOwners.get('/src/app.vue')).toBe('compiler-content')
  settleHmrStyleUpdatePlan(config, old, true)
  expect(getHmrStyleUpdatePlan(config)).toBe(current)
  settleHmrStyleUpdatePlan(config, current, true)
  expect(getHmrStyleUpdatePlan(config)).toBeUndefined()
  next()
})

it('restores outer scopes and isolates projects and final watcher cleanup', async () => {
  const first = {}
  const second = {}
  recordHmrStyleUpdate(first, '/src/first.css')
  recordHmrStyleUpdate(second, '/src/second.css')
  clearPendingHmrStyleUpdates(first)
  const release = beginHmrStyleUpdatePlan(first, [])
  const outer = getHmrStyleUpdatePlan(first)
  expect(outer!.sourceFiles.size).toBe(0)
  const inner = createHmrStyleUpdatePlan([], { full: true })
  await withHmrStyleUpdatePlan(first, inner, async () => {
    expect(getHmrStyleUpdatePlan(first)).toBe(inner)
    expect(getHmrStyleUpdatePlan(second)).toBeUndefined()
  })
  expect(getHmrStyleUpdatePlan(first)).toBe(outer)
  release()
  const releaseSecond = beginHmrStyleUpdatePlan(second, [])
  expect(getHmrStyleUpdatePlan(second)!.styleFiles).toEqual(new Set(['/src/second.css']))
  releaseSecond()
})
