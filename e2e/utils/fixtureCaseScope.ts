/** 在 case 边界排空异步日志，只释放本 case 注册的监听器，并保留原始测试错误。 */
export async function withFixtureCaseScope<C extends { dispose: () => void }, T>(options: {
  flush: () => Promise<void>
  attach: () => C
  run: (collectors: C) => Promise<T>
  verify?: (collectors: C) => Promise<void> | void
}): Promise<T> {
  await options.flush()
  const collectors = options.attach()
  let failed = false
  let failure: unknown
  let result!: T
  try {
    result = await options.run(collectors)
  }
  catch (error) {
    failed = true
    failure = error
  }
  for (const cleanup of [options.flush, () => options.verify?.(collectors), () => collectors.dispose()]) {
    try {
      await cleanup()
    }
    catch (error) {
      // flush 本身会写入 runtime 诊断，已有 case 错误时不覆盖首错。
      if (!failed) {
        failed = true
        failure = error
      }
    }
  }
  if (failed) {
    throw failure
  }
  return result
}
