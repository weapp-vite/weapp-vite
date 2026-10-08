import assert from 'node:assert/strict'

function createRetainedSource(wrap) {
  const source = { handler() {}, filter: { id: /initial/ }, order: 'pre' }
  const create = () => {
    const owner = { generation: 1 }
    const wrapped = wrap(source, () => owner.generation)
    wrapped.filter = { id: /last/ }
    wrapped.order = 'post'
    return { wrapper: new WeakRef(wrapped), owner: new WeakRef(owner) }
  }
  return { source, references: create() }
}
function rawHandler() {}
function createOwnedWrapper(wrap, source) {
  const owner = { order: 'pre', filter: { id: /owner/ } }
  const wrapped = wrap(source, () => owner)
  return { wrapped, references: { wrapper: new WeakRef(wrapped), owner: new WeakRef(owner) } }
}
function createProtectedSource(wrap, supplied) {
  const source = { handler: rawHandler, ...(supplied ? { order: 'pre', filter: { id: /original/ } } : {}) }
  const { wrapped, references } = createOwnedWrapper(wrap, source)
  const second = wrap(source, rawHandler)
  Object.freeze(wrapped)
  assert.throws(() => {
    source.order = 'post'
  }, { name: 'TypeError' })
  assert.throws(() => {
    source.filter = { id: /failed/ }
  }, { name: 'TypeError' })
  return { source, references, second, supplied }
}
function verifyProtectedSource(result) {
  const expectedOrder = result.supplied ? 'pre' : undefined
  const expectedFilter = result.supplied ? 'original' : undefined
  assert.equal(result.source.order, expectedOrder)
  assert.equal(result.source.filter?.id.source, expectedFilter)
  // 首包装器回收后仍须先抛错，不能继续广播给后续活包装器。
  assert.throws(() => {
    result.source.order = 'post'
  }, { name: 'TypeError' })
  assert.throws(() => {
    result.source.filter = { id: /failed-again/ }
  }, { name: 'TypeError' })
  assert.equal(result.second.order, expectedOrder)
  assert.equal(result.second.filter?.id.source, expectedFilter)
  return { supplied: result.supplied, order: result.source.order, filter: result.source.filter?.id.source }
}
function installMetadataAccessors(wrapped) {
  for (const key of ['order', 'filter']) {
    Object.defineProperty(wrapped, key, {
      configurable: true,
      enumerable: true,
      get() { return this.handler()[key] },
      set(value) { this.handler()[key] = value },
    })
  }
}
function createAccessorSource(wrap) {
  const source = { handler: rawHandler, order: 'pre', filter: { id: /initial/ } }
  const { wrapped, references } = createOwnedWrapper(wrap, source)
  installMetadataAccessors(wrapped)
  const second = wrap(source, rawHandler)
  source.order = 'post'
  const replacementFilter = { id: /broadcast/ }
  source.filter = replacementFilter
  assert.equal(source.order, 'post')
  assert.equal(source.filter, replacementFilter)
  assert.equal(second.order, 'post')
  assert.equal(second.filter, replacementFilter)
  return { source, references }
}
function inspectLiveness(result) {
  return {
    wrapperAlive: result.references.wrapper.deref() !== undefined,
    ownerAlive: result.references.owner.deref() !== undefined,
  }
}
function verifyDynamicAccessor(result) {
  assert.deepEqual(inspectLiveness(result), { wrapperAlive: true, ownerAlive: true })
  result.references.owner.deref().order = 'pre'
  result.references.owner.deref().filter = { id: /dynamic/ }
  assert.equal(result.source.order, 'pre')
  assert.equal(result.source.filter.id.source, 'dynamic')
  result.source.order = 'post'
  assert.equal(result.references.owner.deref().order, 'post')
  return { liveness: inspectLiveness(result), order: result.source.order, filter: result.source.filter.id.source }
}
function restoreOrderData(result) {
  const wrapped = result.references.wrapper.deref()
  assert.ok(wrapped)
  Object.defineProperty(wrapped, 'order', { value: 'post', configurable: true, enumerable: true, writable: true })
}
function removeFilterAccessor(result) {
  const wrapped = result.references.wrapper.deref()
  assert.ok(wrapped)
  delete wrapped.filter
}
async function collect() {
  for (let i = 0; i < 8; i++) {
    await new Promise(resolve => setImmediate(resolve))
    globalThis.gc()
  }
  await new Promise(resolve => setImmediate(resolve))
}
export async function verifyOwnership(wrap) {
  assert.equal(typeof globalThis.gc, 'function', 'The hook contract requires an isolated --expose-gc child')
  const retained = createRetainedSource(wrap)
  const protectedSources = [false, true].map(supplied => createProtectedSource(wrap, supplied))
  const accessorSource = createAccessorSource(wrap)
  await collect()
  assert.deepEqual(inspectLiveness(retained), { wrapperAlive: false, ownerAlive: false })
  assert.equal(retained.source.order, 'post')
  assert.equal(retained.source.filter.id.source, 'last')
  const next = wrap(retained.source, rawHandler)
  assert.equal(next.order, 'post')
  assert.equal(next.filter.id.source, 'last')
  retained.source.order = 'pre'
  assert.equal(next.order, 'pre')
  for (const result of protectedSources) {
    verifyProtectedSource(result)
    assert.deepEqual(inspectLiveness(result), { wrapperAlive: false, ownerAlive: false })
  }
  verifyDynamicAccessor(accessorSource)
  restoreOrderData(accessorSource)
  await collect()
  assert.deepEqual(inspectLiveness(accessorSource), { wrapperAlive: true, ownerAlive: true })
  removeFilterAccessor(accessorSource)
  await collect()
  assert.deepEqual(inspectLiveness(accessorSource), { wrapperAlive: false, ownerAlive: false })
  assert.equal(accessorSource.source.order, 'post')
  assert.equal(accessorSource.source.filter, undefined)
  accessorSource.source.order = 'pre'
  assert.equal(accessorSource.source.order, 'pre')
  return ['hook-release', 'readonly-after-gc', 'accessor-release']
}
