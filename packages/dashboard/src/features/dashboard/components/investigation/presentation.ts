import type { DashboardInvestigationStatus, DashboardInvestigationTarget } from 'weapp-vite/dashboard'

export const investigationStatusLabels: Record<DashboardInvestigationStatus, string> = {
  submitted: '等待外部 Agent 领取',
  claimed: '已领取 · 等待提案',
  proposed: '提案待你授权',
  authorized: '已授权 · 等待外部执行',
  executing: 'Agent 已报告开始执行',
  completed: 'Agent 回报完成 · 待复验',
  failed: 'Agent 回报失败',
  cancelled: '调查已取消',
  stale: '原报告已过期',
  verified: '已记录人工复验',
}

/** 完整保留对象归属与路径，避免同名产物或模块被混淆。 */
export function investigationTargetLabel(target: DashboardInvestigationTarget) {
  if (target.kind === 'package') {
    return `包 ${target.packageId}`
  }
  if (target.kind === 'artifact') {
    return `${target.packageId} / ${target.file}`
  }
  return `${target.packageId} / ${target.file} → ${target.moduleId}`
}
