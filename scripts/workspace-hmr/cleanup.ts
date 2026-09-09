export interface WorkspaceHmrCleanupStep {
  label: string
  run: () => Promise<unknown>
}

/** 恢复错误必须保留；某一步失败后仍尝试后续清理和产物校验。 */
export async function collectWorkspaceHmrCleanupErrors(steps: WorkspaceHmrCleanupStep[]) {
  const errors: string[] = []
  for (const step of steps) {
    try {
      await step.run()
    }
    catch (error) {
      errors.push(`${step.label}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return errors
}

/** 恢复失败说明基线已污染，不能把下一次读取的源码当作可靠原始值。 */
export function isWorkspaceHmrScenarioRetryable(result: { error?: string, cleanupErrors?: string[] }) {
  return Boolean(result.error) && !result.cleanupErrors?.length
}
