const locks = new Map<string, Promise<void>>()

export async function withTempDirLock<T>(tempDir: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(tempDir) ?? Promise.resolve()
  let release: (() => void) | undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const current = previous.then(() => gate)
  locks.set(tempDir, current)

  try {
    await previous
    return await fn()
  }
  finally {
    release?.()
    if (locks.get(tempDir) === current) {
      locks.delete(tempDir)
    }
  }
}
