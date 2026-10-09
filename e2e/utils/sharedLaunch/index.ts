/** 合并共享获取并锁存首错；独立启动与显式重启也不能绕过失败状态。 */
export function createSharedLaunch<T>() {
  let pending: Promise<T> | undefined
  let failure: { error: unknown } | undefined

  async function run(launch: () => Promise<T>): Promise<T> {
    if (failure) {
      throw failure.error
    }
    try {
      return await launch()
    }
    catch (error) {
      failure ??= { error }
      throw failure.error
    }
  }

  return {
    run,
    shared(launch: () => Promise<T>): Promise<T> {
      pending ??= Promise.resolve().then(() => run(launch)).then((session) => {
        pending = undefined
        return session
      })
      return pending
    },
  }
}
