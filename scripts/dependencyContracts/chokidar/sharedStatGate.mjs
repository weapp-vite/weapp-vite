import assert from 'node:assert/strict'
import { deferred } from './support.mjs'

/** 暂停同一共享文件的原生 stat，分别控制真实结果取得与原对象交还。 */
export function createSharedStatGate(file) {
  const requests = []
  const pair = deferred()
  const firstWaveClosed = deferred()
  let armed = false
  let released = false
  let firstWaveOpen = false
  const requestAt = (index) => {
    const request = requests[index]
    assert.ok(request, `Exact shared-file stat request ${index} must already be captured`)
    return request
  }
  return {
    file,
    requests,
    pair: pair.promise,
    firstWaveClosed: firstWaveClosed.promise,
    arm() {
      assert.equal(armed, false, 'The exact shared stat phase is armed only once')
      armed = true
    },
    run(index) { requestAt(index).execute.resolve() },
    deliver(index) { requestAt(index).delivery.resolve() },
    releaseAll() {
      released = true
      for (const request of requests) {
        request.execute.resolve()
        request.delivery.resolve()
      }
    },
    async hook({ file: attempted, original }) {
      if (!armed || released || attempted !== file) {
        return original()
      }
      if (requests.length === 0) {
        firstWaveOpen = true
        void Promise.resolve().then(() => {
          firstWaveOpen = false
          firstWaveClosed.resolve()
        })
      }
      const request = {
        execute: deferred(),
        delivery: deferred(),
        observed: deferred(),
        returned: deferred(),
        firstWave: firstWaveOpen,
        nativeStats: undefined,
        nativeError: undefined,
        deliveredError: undefined,
      }
      requests.push(request)
      if (requests.length === 2) {
        pair.resolve()
      }
      await request.execute.promise
      let failed = false
      try {
        request.nativeStats = await original()
      }
      catch (error) {
        failed = true
        request.nativeError = error
      }
      request.observed.resolve()
      await request.delivery.promise
      request.returned.resolve()
      if (failed) {
        request.deliveredError = request.nativeError
        throw request.nativeError
      }
      return request.nativeStats
    },
  }
}
