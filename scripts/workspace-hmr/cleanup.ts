export interface WorkspaceHmrCleanupStep {
  label: string
  run: () => Promise<unknown>
}

/** 正式验收默认不重试；显式正数仅用于诊断，不能替代首轮失败证据。 */
export function readWorkspaceHmrScenarioRetries(raw: string | undefined) {
  if (raw === undefined || raw.trim() === '') {
    return 0
  }
  const value = Number(raw)
  if (!/^\d+$/.test(raw.trim()) || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid WORKSPACE_HMR_SCENARIO_RETRIES: ${raw}`)
  }
  return value
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
