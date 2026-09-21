import { describe, expect, it } from 'vitest'
import { batch, ref, watch } from '@/reactivity'
import { nextTick } from '@/scheduler'
import { createStore, defineStore, disposePinia } from '@/store'

describe('mini-program Store subscription batching', () => {
  it.each(['sync', 'pre', 'post'] as const)('refreshes %s dependencies once per patch, independent of write count', async (flush) => {
    const owner = createStore()
    let reads = 0
    const rows = Array.from({ length: 1000 }, (_, i) => ({ get value() {
      reads++
      return i
    } }))
    const store = defineStore('cost', { state: () => ({ n: 0, rows }) })(owner)
    const events: string[] = []
    for (let i = 0; i < 3; i++) {
      store.$subscribe(m => events.push(m.type), { flush })
    }
    const values: number[] = []
    const stop = watch(() => store.n, n => values.push(n), { flush: 'sync' })
    try {
      reads = 0
      store.$patch((state) => {
        for (let n = 1; n <= 20; n++) {
          state.n = n
        }
      })
      await nextTick()
      await nextTick()
      expect(reads).toBe(3000)
      expect(values).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
      expect(events).toEqual(Array.from({ length: 3 }).fill('patch function'))
    }
    finally {
      stop()
      disposePinia(owner)
    }
  })

  it.each(['sync', 'pre', 'post'] as const)('does not leak %s direct notifications from an enclosing batch', async (flush) => {
    const owner = createStore()
    const store = defineStore('batch', { state: () => ({ n: 0, nested: { n: 0 } }) })(owner)
    const events: string[] = []
    store.$subscribe((m, s) => events.push(`${m.type}:${s.n}`), { flush })
    try {
      batch(() => {
        store.$patch({ n: 1 })
        expect(events).toEqual(['patch object:1'])
        batch(() => store.$patch(s => s.n = 2))
        store.$patch(s => s.nested = { n: 3 })
      })
      const patches = ['patch object:1', 'patch function:2', 'patch function:2']
      expect(events).toEqual(patches)
      await nextTick()
      await nextTick()
      expect(events).toEqual(patches)
      store.nested.n++
      await nextTick()
      await nextTick()
      expect(events).toEqual([...patches, 'direct:2'])
    }
    finally {
      disposePinia(owner)
    }
  })

  it('coalesces default dependency refresh across multiple patches in the same tick', async () => {
    const owner = createStore()
    let reads = 0
    const store = defineStore('multiple', { state: () => ({ n: 0, row: { get value() {
      reads++
      return 1
    } } }) })(owner)
    const events: string[] = []
    store.$subscribe(m => events.push(m.type))
    try {
      reads = 0
      for (let n = 1; n <= 20; n++) {
        store.$patch({ n })
      }
      await nextTick()
      expect(reads).toBe(1)
      expect(events).toEqual(Array.from({ length: 20 }).fill('patch object'))
    }
    finally {
      disposePinia(owner)
    }
  })

  it('restores dependencies after a failed patch and discards obsolete queued direct jobs', async () => {
    const owner = createStore()
    const store = defineStore('failure', () => ({ data: ref({ n: 0 }) }))(owner)
    const events: string[] = []
    store.$subscribe(m => events.push(m.type))
    try {
      store.data.n++
      expect(() => batch(() => store.$patch((s) => {
        s.data = { n: 2 }
        throw new Error('patch failed')
      }))).toThrow('patch failed')
      await nextTick()
      expect(events).toEqual([])
      store.data.n++
      await nextTick()
      expect(events).toEqual(['direct'])
    }
    finally {
      disposePinia(owner)
    }
  })

  it('tracks subscriptions registered during a patch and releases disposed subscriptions', async () => {
    const owner = createStore()
    const store = defineStore('registration', { state: () => ({ n: 0 }) })(owner)
    const events: string[] = []
    try {
      batch(() => store.$patch((s) => {
        store.$subscribe(m => events.push(m.type), { flush: 'sync' })
        s.n++
      }))
      await nextTick()
      expect(events).toEqual(['patch function'])
      store.n++
      expect(events).toEqual(['patch function', 'direct'])
      batch(() => store.$patch((s) => {
        s.n++
        store.$dispose()
      }))
      await nextTick()
      store.n++
      expect(events).toEqual(['patch function', 'direct'])
    }
    finally {
      disposePinia(owner)
    }
  })

  it('recollects replaced branches and refs without retaining detached dependencies', async () => {
    const owner = createStore()
    const store = defineStore('replacement', () => ({ data: ref({ rows: [{ n: 0 }] }) }))(owner)
    const events: string[] = []
    store.$subscribe(m => events.push(m.type), { flush: 'sync' })
    try {
      const previous = store.data.rows[0]!
      batch(() => store.$patch(s => s.data = { rows: [{ n: 1 }] }))
      await nextTick()
      previous.n++
      expect(events).toEqual(['patch function'])
      store.data.rows.push({ n: 2 })
      store.data.rows[1]!.n++
      batch(() => store.data.rows.splice(0, 1))
      expect(events).toEqual(['patch function', 'direct', 'direct', 'direct'])
    }
    finally {
      disposePinia(owner)
    }
  })

  it('keeps refreshing remaining subscriptions if one state getter throws', () => {
    const owner = createStore()
    let fail = false
    const store = defineStore('refresh-error', { state: () => ({
      n: 0,
      nested: { get value() {
        if (fail) {
          throw new Error('getter failed')
        }
        return 0
      } },
    }) })(owner)
    const events: string[] = []
    store.$subscribe(() => {}, { flush: 'sync' })
    store.$subscribe(m => events.push(m.type), { flush: 'sync', deep: 1 })
    try {
      expect(() => store.$patch((s) => {
        s.n++
        fail = true
      })).toThrow('getter failed')
      fail = false
      store.n++
      expect(events).toEqual(['direct'])
    }
    finally {
      disposePinia(owner)
    }
  })

  it('restores asynchronous listening even when dependency refresh rejects the tick', async () => {
    const owner = createStore()
    let fail = false
    const store = defineStore('async-refresh-error', { state: () => ({
      n: 0,
      nested: { get value() {
        if (fail) {
          throw new Error('async getter failed')
        }
        return 0
      } },
    }) })(owner)
    const events: string[] = []
    store.$subscribe(() => {})
    store.$subscribe(m => events.push(m.type), { deep: 1 })
    try {
      store.$patch((s) => {
        s.n++
        fail = true
      })
      await expect(nextTick()).rejects.toThrow('async getter failed')
      fail = false
      store.n++
      await nextTick()
      expect(events).toEqual(['patch function', 'direct'])
    }
    finally {
      disposePinia(owner)
    }
  })
})
