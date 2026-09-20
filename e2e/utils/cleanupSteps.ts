import process from 'node:process'

interface CleanupStep {
  label: string
  run: () => void | Promise<void>
}

/** 按所有权顺序释放资源；某一步失败仍执行剩余恢复，最后保留全部失败。 */
export async function runCleanupSteps(steps: CleanupStep[]) {
  const errors: Error[] = []
  for (const step of steps) {
    const startedAt = Date.now()
    let failed = false
    try {
      await step.run()
    }
    catch (cause) {
      failed = true
      errors.push(new Error(`Cleanup failed: ${step.label}`, { cause }))
    }
    finally {
      process.stdout.write(`[e2e-cleanup] ${step.label} status=${failed ? 'failed' : 'passed'} durationMs=${Date.now() - startedAt}\n`)
    }
  }
  if (errors.length) {
    throw new AggregateError(errors, 'E2E cleanup did not complete successfully')
  }
}
