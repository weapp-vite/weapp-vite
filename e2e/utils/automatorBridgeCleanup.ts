export interface BridgeSnapshotCleanup {
  stopSync?: () => void
  cleanup?: () => Promise<void>
}

/** 并发调用等待同一次清理；失败保留重试机会，成功后不再重复释放。 */
export function createRetryableCleanup(cleanup: () => Promise<void>) {
  let pending: Promise<void> | undefined
  return () => {
    pending ??= Promise.resolve().then(cleanup).catch((error: unknown) => {
      pending = undefined
      throw error
    })
    return pending
  }
}

/** 窗口归属未终结时保留快照；本地 watcher 和日志订阅始终停止。 */
export async function cleanupFailedBridgeLaunch(options: {
  error: unknown
  bridgeLaunch?: Promise<unknown>
  getCloseProject?: () => (() => Promise<void>) | undefined
  snapshot?: BridgeSnapshotCleanup
  subscription?: { abort: (reason: unknown) => void }
}) {
  const errors: unknown[] = []
  for (const stop of [() => options.snapshot?.stopSync?.(), () => options.subscription?.abort(options.error)]) {
    try {
      stop()
    }
    catch (error) {
      errors.push(error)
    }
  }
  // 取消 CLI 不证明宿主已撤回启动；先等桥接结束，再使用其登记的窗口清理。
  await options.bridgeLaunch?.catch(() => {})
  try {
    const closeProject = options.getCloseProject?.()
    await closeProject?.()
    if (closeProject || !options.bridgeLaunch) {
      await options.snapshot?.cleanup?.()
    }
  }
  catch (error) {
    errors.push(error)
  }
  if (errors.length) {
    throw new AggregateError([options.error, ...errors], 'IDE launch failed and its owned resources could not be released')
  }
}

export function attachBridgeWrapperSyncCleanup(miniProgram: any, snapshot: BridgeSnapshotCleanup | undefined) {
  if (!snapshot?.stopSync) {
    return miniProgram
  }
  const cleanup = createRetryableCleanup(async () => {
    await snapshot.cleanup?.()
  })
  let stopped = false
  const stopSync = () => {
    if (!stopped) {
      snapshot.stopSync?.()
      stopped = true
    }
  }
  for (const methodName of ['close', 'disconnect']) {
    const rawMethod = miniProgram?.[methodName]
    if (typeof rawMethod !== 'function') {
      continue
    }
    miniProgram[methodName] = async (...args: any[]) => {
      let completed = false
      try {
        const result = await rawMethod.apply(miniProgram, args)
        completed = true
        return result
      }
      finally {
        stopSync()
        if (methodName === 'close' && completed) {
          await cleanup()
        }
      }
    }
  }
  return miniProgram
}
