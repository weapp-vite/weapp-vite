/** 所有并行写入结束后才交还目录所有权，并优先保留主构建诊断。 */
export async function settleBuildTasks<T>(build: Promise<T>, background: Promise<unknown>[]): Promise<T> {
  const primary = build.then(
    value => ({ status: 'fulfilled' as const, value }),
    reason => ({ status: 'rejected' as const, reason }),
  )
  const [result, auxiliary] = await Promise.all([primary, Promise.allSettled(background)])
  if (result.status === 'rejected') {
    throw result.reason
  }
  for (const task of auxiliary) {
    if (task.status === 'rejected') {
      throw task.reason
    }
  }
  return result.value
}
