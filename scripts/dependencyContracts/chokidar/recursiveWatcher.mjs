import assert from 'node:assert/strict'

/** Node 的 JS recursive 包装器以全部精确子句柄的终结证据确认关闭。 */
export function observeRecursiveWatcher(native, details) {
  const completion = Promise.withResolvers()
  completion.promise.catch(() => {})
  const scope = details.recursiveScope
  const record = {
    ...details,
    kind: 'recursive-wrapper',
    native,
    closed: false,
    closeCalls: 0,
    closeEvents: 0,
    errorEvents: 0,
    observationErrors: [],
    closePromise: completion.promise,
  }
  const fail = (error) => {
    record.closed = false
    record.observationErrors.push(error)
    completion.reject(error)
  }
  const originalClose = native.close
  let closing = false
  native.close = function (...args) {
    record.closeCalls++
    if (this !== native) {
      fail(new Error('Recursive public close must use its captured wrapper'))
    }
    scope.closing = true
    closing = true
    try {
      return originalClose.apply(this, args)
    }
    catch (error) {
      fail(error)
      throw error
    }
    finally { closing = false }
  }
  native.on('error', (error) => {
    record.errorEvents++
    record.lastError = { code: error.code, message: error.message }
    fail(error)
  })
  native.on('close', () => {
    record.closeEvents++
    if (!closing || record.closeEvents !== 1 || !scope.children.length) {
      fail(new Error('Recursive close requires its original public call and captured native children'))
      return
    }
    const children = [...scope.children]
    void Promise.all(children.map(child => child.closePromise)).then(() => {
      try {
        assertRecursiveWatcherClosed({ ...record, closed: true })
        assert.deepEqual(scope.children, children, 'A closing recursive wrapper cannot acquire another child')
        record.closed = true
        record.termination = 'recursive-public-close'
        completion.resolve()
      }
      catch (error) { fail(error) }
    }, fail)
  })
  return record
}

/** 包装器事件与子句柄原生完成缺一不可；未知形状不纳入此分支。 */
export function assertRecursiveWatcherClosed(record, exactlyOnce = false) {
  assert.deepEqual(record.observationErrors, [], 'Recursive watcher observation must remain valid')
  assert.equal(record.closed, true, 'Recursive wrapper requires completed child native closures')
  assert.equal(record.closeEvents, 1)
  assert.equal(record.errorEvents, 0)
  assert.deepEqual(record.recursiveScope.lateAcquisitions, [])
  assert.ok(record.recursiveScope.children.length > 0)
  for (const child of record.recursiveScope.children) {
    assert.deepEqual(child.observationErrors, [])
    assert.equal(child.closed, true)
    assert.equal(child.nativeCloseRequests, 1)
    assert.equal(child.nativeCloseCompletions, 1)
    assert.equal(child.native._handle, null)
  }
  if (exactlyOnce) {
    assert.equal(record.closeCalls, 1, 'Shared recursive wrapper closes once')
  }
}
