interface ProductionRuntimeCleanupOptions {
  closeRuntime: () => Promise<unknown>
  closeBuild: () => Promise<unknown>
  removeFixture: () => Promise<unknown>
  pendingFailures?: readonly unknown[]
}

/** 独立关闭运行时与构建资源；只有两者均释放后才删除工程，保留所有首错。 */
export async function releaseProductionRuntimeResources(options: ProductionRuntimeCleanupOptions) {
  const failures = [...options.pendingFailures ?? []]
  let ownersClosed = true
  for (const operation of [options.closeRuntime, options.closeBuild]) {
    try {
      await operation()
    }
    catch (error) {
      ownersClosed = false
      failures.push(error)
    }
  }
  if (ownersClosed) {
    try {
      await options.removeFixture()
    }
    catch (error) {
      failures.push(error)
    }
  }
  if (failures.length) {
    throw new AggregateError(failures, 'Mode/cache runtime resources did not close cleanly', { cause: failures[0] })
  }
}
