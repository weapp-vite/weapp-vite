import assert from 'node:assert/strict'

function rawHandler() {}

const plain = value => JSON.parse(JSON.stringify(value))
export function verifyMetadata(wrap) {
  const outcomes = []
  for (const supplied of [false, true]) {
    const rawHandler = () => 'raw'
    const source = { handler: rawHandler, ...(supplied ? { filter: { id: /initial/ }, order: 'pre' } : {}) }
    const firstHandler = () => 'first'
    const secondHandler = () => 'second'
    const first = wrap(source, firstHandler)
    const second = wrap(source, secondHandler)
    assert.equal(first.handler, firstHandler)
    assert.equal(second.handler, secondHandler)
    assert.equal(source.handler, rawHandler)
    assert.equal(Object.hasOwn(first, 'order'), supplied)
    assert.equal(Object.hasOwn(first, 'filter'), supplied)
    for (const key of ['filter', 'order']) {
      if (supplied) {
        assert.equal('value' in Object.getOwnPropertyDescriptor(first, key), true)
      }
    }
    const sharedFilter = { id: /shared/ }
    source.filter = sharedFilter
    source.order = 'post'
    assert.equal(first.filter, sharedFilter)
    assert.equal(second.filter, sharedFilter)
    assert.equal(first.order, 'post')
    assert.equal(second.order, 'post')
    first.order = undefined
    first.filter = undefined
    assert.equal(source.order, undefined)
    assert.equal(source.filter, undefined)
    second.order = 'pre'
    second.filter = { id: /second-only/ }
    assert.equal(source.order, undefined)
    assert.equal(source.filter, undefined)
    Object.defineProperty(first, 'order', { value: 'pre', configurable: true, writable: true })
    assert.equal(source.order, 'pre')
    delete first.filter
    assert.equal(source.filter, undefined)
    const third = wrap(source, () => 'third')
    // Vite 仅复制原对象的可枚举属性。
    assert.equal(third.order, supplied ? 'pre' : undefined)
    assert.deepEqual(Object.keys(source), supplied ? ['handler', 'filter', 'order'] : ['handler'])
    assert.deepEqual(Object.keys(first), ['handler', 'order'])
    assert.deepEqual(Object.keys(second), ['handler', 'filter', 'order'])
    assert.deepEqual(Object.keys(third), supplied ? ['handler', 'filter', 'order'] : ['handler'])
    assert.deepEqual(Object.getOwnPropertyDescriptor(first, 'order'), {
      value: 'pre',
      writable: true,
      enumerable: true,
      configurable: true,
    })
    outcomes.push({ supplied, sourceKeys: Object.keys(source), firstKeys: Object.keys(first), secondKeys: Object.keys(second), thirdKeys: Object.keys(third), firstOrderDescriptor: Object.getOwnPropertyDescriptor(first, 'order') })
  }
  return plain(outcomes)
}
export function verifyFailedWrites(wrap) {
  const outcomes = []
  for (const failedIndex of [0, 1]) {
    const source = { handler: rawHandler, order: 'pre' }
    const wrappers = Array.from({ length: 3 }, () => wrap(source, rawHandler))
    Object.freeze(wrappers[failedIndex])
    assert.throws(() => {
      source.order = 'post'
    }, { name: 'TypeError' })
    const values = wrappers.map(wrapper => wrapper.order)
    assert.deepEqual(values, failedIndex === 0 ? ['pre', 'pre', 'pre'] : ['post', 'pre', 'pre'])
    assert.equal(source.order, values[0])
    outcomes.push({ failedIndex, sourceOrder: source.order, values })
  }
  return outcomes
}
export function verifyReentrantWrites(wrap) {
  const outcomes = []
  for (const failAppended of [false, true]) {
    const source = { handler: rawHandler, order: 'pre' }
    const wrappers = [wrap(source, rawHandler), wrap(source, rawHandler)]
    const events = []
    const failure = new Error('nested broadcast stopped')
    let appended = false
    const track = (wrapper, label, beforeSet) => {
      let value = wrapper.order
      Object.defineProperty(wrapper, 'order', {
        configurable: true,
        enumerable: true,
        get() { return value },
        set(next) {
          events.push(`${label}:${next}`)
          beforeSet?.(next)
          value = next
        },
      })
    }
    track(wrappers[0], 'first', () => {
      if (appended) {
        return
      }
      appended = true
      const third = wrap(source, rawHandler)
      const fourth = wrap(source, rawHandler)
      wrappers.push(third, fourth)
      track(third, 'third', (value) => {
        if (failAppended && value === 'post') {
          throw failure
        }
      })
      track(fourth, 'fourth')
    })
    track(wrappers[1], 'second')
    if (failAppended) {
      assert.throws(() => {
        source.order = 'post'
      }, error => error === failure)
    }
    else { source.order = 'post' }
    const firstBroadcast = { events: [...events], orders: wrappers.map(wrapper => wrapper.order) }
    assert.deepEqual(firstBroadcast.events, failAppended ? ['first:post', 'second:post', 'third:post'] : ['first:post', 'second:post', 'third:post', 'fourth:post'])
    assert.deepEqual(firstBroadcast.orders, failAppended ? ['post', 'post', 'pre', 'pre'] : ['post', 'post', 'post', 'post'])
    events.length = 0
    source.order = 'pre'
    const secondBroadcast = { events: [...events], orders: wrappers.map(wrapper => wrapper.order) }
    assert.deepEqual(secondBroadcast.events, ['first:pre', 'second:pre', 'third:pre', 'fourth:pre'])
    assert.deepEqual(secondBroadcast.orders, ['pre', 'pre', 'pre', 'pre'])
    outcomes.push({ failAppended, firstBroadcast, secondBroadcast })
  }
  return outcomes
}
