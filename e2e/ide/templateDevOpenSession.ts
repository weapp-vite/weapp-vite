interface TemplateDevOpenExecution<Session> {
  name: string
  open: () => Promise<Session>
  run: (session: Session) => Promise<void>
  cleanup: () => Promise<void>
}

/** 每个模板只打开一次；任何失败都保留首错并禁止后续模板冷启动。 */
export function createTemplateDevOpenRunner() {
  let blockedBy: { name: string, cause: unknown } | undefined

  return async function runTemplateDevOpenCase<Session>(options: TemplateDevOpenExecution<Session>) {
    if (blockedBy) {
      throw new Error(`Template IDE startup blocked after ${blockedBy.name} failed; refusing to open ${options.name}`, {
        cause: blockedBy.cause,
      })
    }

    let failure: { error: unknown } | undefined
    try {
      const session = await options.open()
      await options.run(session)
    }
    catch (error) {
      failure = { error }
      blockedBy = { name: options.name, cause: error }
    }

    try {
      await options.cleanup()
    }
    catch (cleanupError) {
      blockedBy ??= { name: options.name, cause: cleanupError }
      if (failure) {
        throw new AggregateError([failure.error, cleanupError], 'Template runtime and cleanup failed', {
          cause: failure.error,
        })
      }
      throw cleanupError
    }

    if (failure) {
      throw failure.error
    }
  }
}
