/** 任一子构建失败后仍等待所有已启动任务，保留最先排列的原始错误。 */
export async function waitForBuildTasks<T extends readonly unknown[]>(tasks: { [K in keyof T]: Promise<T[K]> }): Promise<T> {
  const results = await Promise.allSettled(tasks)
  const failure = results.find(result => result.status === 'rejected')
  if (failure?.status === 'rejected') {
    throw failure.reason
  }
  return results.map(result => (result as PromiseFulfilledResult<unknown>).value) as unknown as T
}
