const ownedCleanups = new Set<() => Promise<void>>()

/** 只登记本次启动取得的资源；进程名、安装路径及共享临时目录均不能证明所有权。 */
export function ownDevtoolsCleanup(cleanup: () => Promise<void>) {
  let pending: Promise<void> | undefined
  const dispose = () => {
    pending ??= Promise.resolve().then(cleanup).then(() => {
      ownedCleanups.delete(dispose)
    }).catch((error: unknown) => {
      pending = undefined
      throw error
    })
    return pending
  }
  ownedCleanups.add(dispose)
  return dispose
}

export async function cleanupOwnedDevtoolsProcesses() {
  const results = await Promise.allSettled([...ownedCleanups].map(dispose => dispose()))
  const errors = results.filter(result => result.status === 'rejected').map(result => result.reason)
  if (errors.length) {
    throw new AggregateError(errors, 'Failed to clean owned DevTools processes')
  }
}
