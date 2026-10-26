import assert from 'node:assert/strict'
import { assertRecursiveWatcherClosed, observeRecursiveWatcher } from './recursiveWatcher.mjs'

/** 分别观察公开关闭事件与同一个 FSEvent 的原生关闭完成，不补发任何事件。 */
export function observeNativeWatcher(native, details) {
  if (!Object.hasOwn(native, '_handle') && details.recursiveScope) {
    return observeRecursiveWatcher(native, details)
  }
  const completion = Promise.withResolvers()
  // 观察期间可能先拒绝，最终统一由契约收尾读取同一个原始失败。
  completion.promise.catch(() => {})
  const record = {
    ...details,
    native,
    closed: false,
    closeCalls: 0,
    closeEvents: 0,
    nativeCloseRequests: 0,
    nativeCloseCompletions: 0,
    errorEvents: 0,
    observationErrors: [],
    closePromise: completion.promise,
  }
  const handle = native._handle
  let publicCloseDepth = 0
  let pendingCallbacks = 0
  let errorReleasedHandle = false
  const fail = (error) => {
    record.closed = false
    record.observationErrors.push(error)
    completion.reject(error)
  }
  const check = () => {
    if (record.observationErrors.length || pendingCallbacks || record.nativeCloseCompletions !== 1) {
      return
    }
    if (native._handle !== null) {
      fail(new Error('The captured native FSEvent completed without releasing its exact wrapper handle'))
      return
    }
    if (record.nativeCloseOrigin === 'public' && record.closeEvents === 1 && !record.errorEvents) {
      record.termination = 'public-close'
    }
    else if (record.nativeCloseOrigin === 'native' && errorReleasedHandle && record.errorEvents === 1 && !record.closeEvents) {
      record.termination = 'native-error'
    }
    else { return }
    record.closed = true
    completion.resolve()
  }
  if (!Object.hasOwn(native, '_handle') || handle?.constructor?.name !== 'FSEvent'
    || handle.initialized !== true || typeof handle.close !== 'function') {
    fail(new Error('Unsupported fs.watch native handle shape; recursive or unknown watchers cannot claim FSEvent cleanup'))
  }
  else {
    const originalNativeClose = handle.close
    handle.close = function (...args) {
      record.nativeCloseRequests++
      record.nativeCloseOrigin ??= publicCloseDepth ? 'public' : 'native'
      if (this !== handle || native._handle !== handle || record.nativeCloseRequests !== 1) {
        fail(new Error('Native close must belong to the exact captured FSEvent and run once'))
      }
      const originalCallback = args[0]
      const callback = function (...callbackArgs) {
        record.nativeCloseCompletions++
        pendingCallbacks++
        if (this !== handle || record.nativeCloseCompletions !== 1) {
          fail(new Error('Native close completion must belong to the exact captured FSEvent and run once'))
        }
        try {
          const result = typeof originalCallback === 'function' ? originalCallback.apply(this, callbackArgs) : undefined
          if (result && typeof result.then === 'function') {
            void result.then(() => {
              pendingCallbacks--
              check()
            }, (error) => {
              pendingCallbacks--
              fail(error)
            })
          }
          else {
            pendingCallbacks--
            check()
          }
          return result
        }
        catch (error) {
          pendingCallbacks--
          fail(error)
          throw error
        }
      }
      try {
        return originalNativeClose.apply(this, [callback, ...args.slice(1)])
      }
      catch (error) {
        fail(error)
        throw error
      }
    }
  }
  const originalClose = native.close
  native.close = function (...args) {
    record.closeCalls++
    if (this !== native || (native._handle !== handle && native._handle !== null)) {
      fail(new Error('Public close cannot replace or borrow the captured watcher handle'))
    }
    publicCloseDepth++
    try {
      return originalClose.apply(this, args)
    }
    catch (error) {
      fail(error)
      throw error
    }
    finally { publicCloseDepth-- }
  }
  native.on('close', () => {
    record.closeEvents++
    if (record.closeEvents !== 1 || record.nativeCloseOrigin !== 'public') {
      fail(new Error('A public close event cannot substitute for exact native closure evidence'))
    }
    check()
  })
  native.on('error', (error) => {
    record.lastError = { code: error.code, message: error.message }
    record.errorEvents++
    errorReleasedHandle = native._handle === null && record.nativeCloseRequests === 1 && record.nativeCloseOrigin === 'native'
    if (!errorReleasedHandle || record.errorEvents !== 1) {
      fail(new Error('A native error alone cannot prove that its captured FSEvent was released'))
    }
    check()
  })
  return record
}

/** 原生完成、公开事件和错误路径各自核验；共享 inode 仍保留原先一次公开关闭的契约。 */
export function assertNativeWatcherClosed(record, exactlyOnce = false) {
  if (record.kind === 'recursive-wrapper') {
    assertRecursiveWatcherClosed(record, exactlyOnce)
    return
  }
  assert.deepEqual(record.observationErrors, [], 'Native watcher observation must remain valid')
  assert.equal(record.closed, true, 'Every captured FSEvent must have confirmed terminal evidence')
  assert.equal(record.nativeCloseRequests, 1, 'Every captured FSEvent closes once')
  assert.equal(record.nativeCloseCompletions, 1, 'Every captured FSEvent completes its actual native close once')
  assert.equal(record.native._handle, null, 'The watcher must release the captured native handle')
  if (record.termination === 'native-error') {
    assert.equal(record.nativeCloseOrigin, 'native')
    assert.equal(record.errorEvents, 1)
    assert.equal(record.closeEvents, 0, 'Node native errors deliberately omit the public close event')
  }
  else {
    assert.equal(record.termination, 'public-close')
    assert.equal(record.nativeCloseOrigin, 'public')
    assert.equal(record.closeEvents, 1)
    assert.equal(record.errorEvents, 0)
  }
  if (exactlyOnce) {
    assert.equal(record.closeCalls, 1, 'Shared inode native handles receive one public close, including repeated owner close')
    assert.equal(record.closeEvents, 1, 'Shared inode native handles retain their one public close event contract')
  }
}

/**
 * Darwin 的目录 watch 返回时，CF 线程可能尚未启动事件流。
 * libuv 关闭一个同 loop 的辅助目录句柄时，会同步重建其余订阅的流后才完成原生关闭。
 * 这里只登记并关闭 fixture 自己的辅助句柄；调用方仍须验证真实通知并保留其余订阅的错误。
 */
export function closeDarwinRegistrationBarrier({ actualPlatform, directory, watch, register }) {
  if (actualPlatform !== 'darwin') {
    return undefined
  }
  const native = watch(directory)
  const observation = observeNativeWatcher(native, { path: '.', purpose: 'directory-registration-barrier' })
  register(observation)
  native.close()
  return observation
}
