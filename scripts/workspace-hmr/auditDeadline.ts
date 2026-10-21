export interface WorkspaceHmrAuditBudget {
  deadline: number
  signal?: AbortSignal
}

/** 所有交付阶段共用绝对截止时间，异步操作返回后仍须拒绝逾期结果。 */
export function assertHmrAuditBudget(budget: WorkspaceHmrAuditBudget, message: string) {
  budget.signal?.throwIfAborted()
  if (Date.now() >= budget.deadline) {
    throw new Error(message)
  }
}
