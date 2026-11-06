import { describe, expect, it, vi } from 'vitest'
import { EntryChunkLifecycle } from './entryChunkLifecycle'
import { bindEntryChunkLifecycle, readEntryChunkLifecycle } from './entryChunkLifecycleRegistry'

describe('entry chunk lifecycle registry', () => {
  it('keeps independent scopes isolated', () => {
    const firstScope = {}
    const secondScope = {}
    const first = new EntryChunkLifecycle(vi.fn())
    const second = new EntryChunkLifecycle(vi.fn())
    expect(readEntryChunkLifecycle(firstScope)).toBeUndefined()

    const releaseFirst = bindEntryChunkLifecycle(firstScope, first)
    const releaseSecond = bindEntryChunkLifecycle(secondScope, second)
    try {
      expect(readEntryChunkLifecycle(firstScope)).toBe(first)
      expect(readEntryChunkLifecycle(secondScope)).toBe(second)
      expect(readEntryChunkLifecycle({})).toBeUndefined()

      releaseFirst()
      expect(readEntryChunkLifecycle(firstScope)).toBeUndefined()
      expect(readEntryChunkLifecycle(secondScope)).toBe(second)
    }
    finally {
      releaseFirst()
      releaseSecond()
    }
  })

  it.each([false, true])('preserves a replacement binding after an old release (same lifecycle: %s)', (sameLifecycle) => {
    const scope = {}
    const first = new EntryChunkLifecycle(vi.fn())
    const replacement = sameLifecycle ? first : new EntryChunkLifecycle(vi.fn())
    const releaseFirst = bindEntryChunkLifecycle(scope, first)
    const releaseReplacement = bindEntryChunkLifecycle(scope, replacement)
    try {
      releaseFirst()
      expect(readEntryChunkLifecycle(scope)).toBe(replacement)
    }
    finally {
      releaseFirst()
      releaseReplacement()
    }
    expect(readEntryChunkLifecycle(scope)).toBeUndefined()
  })

  it('allows repeated cleanup without releasing a later binding', () => {
    const scope = {}
    const release = bindEntryChunkLifecycle(scope, new EntryChunkLifecycle(vi.fn()))
    release()
    release()
    expect(readEntryChunkLifecycle(scope)).toBeUndefined()

    const next = new EntryChunkLifecycle(vi.fn())
    const releaseNext = bindEntryChunkLifecycle(scope, next)
    try {
      release()
      expect(readEntryChunkLifecycle(scope)).toBe(next)
    }
    finally {
      releaseNext()
      releaseNext()
    }
    expect(readEntryChunkLifecycle(scope)).toBeUndefined()
  })

  it('shares current build registration and permits the same source in the next build', () => {
    const scope = {}
    const requestFullBuild = vi.fn()
    const lifecycle = new EntryChunkLifecycle(requestFullBuild)
    const release = bindEntryChunkLifecycle(scope, lifecycle)
    const source = 'components/Card.vue'
    const normalizeSource = (request: string) => request === './Card.vue' || request === '@components/Card.vue'
      ? source
      : request
    const register = (request: string) => readEntryChunkLifecycle(scope)!.prepare(normalizeSource(request), true)
    try {
      lifecycle.beginBuild()
      expect(register('./Card.vue')).toBe(true)
      expect(register('@components/Card.vue')).toBe(false)
      lifecycle.endBuild()
      expect(register(source)).toBe(false)

      lifecycle.beginBuild()
      expect(readEntryChunkLifecycle(scope)).toBe(lifecycle)
      expect(register('@components/Card.vue')).toBe(true)
      expect(register('./Card.vue')).toBe(false)
      expect(requestFullBuild).not.toHaveBeenCalled()
    }
    finally {
      release()
    }
  })
})
