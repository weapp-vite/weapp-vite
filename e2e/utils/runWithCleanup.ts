/** 清理始终执行一次；同时失败时保留正文首错和清理错误，不改变两者原始值。 */
export async function runWithCleanup<T>(body: () => T | Promise<T>, cleanup: () => void | Promise<void>): Promise<T> {
  let bodyFailed = false
  let bodyError: unknown
  let result!: T
  try {
    result = await body()
  }
  catch (error) {
    bodyFailed = true
    bodyError = error
  }
  try {
    await cleanup()
  }
  catch (cleanupError) {
    if (bodyFailed) {
      throw new AggregateError([bodyError, cleanupError], 'E2E action and cleanup both failed', { cause: bodyError })
    }
    throw cleanupError
  }
  if (bodyFailed) {
    throw bodyError
  }
  return result
}
