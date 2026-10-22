import type { ImpactFile } from './types'

export type WorkspaceHmrExpectedDelivery = 'stateful' | 'classic' | 'classic-fallback'

export interface WorkspaceHmrScenarioCapability {
  statefulTemplate?: boolean
  classicFallbackReason?: string
}

export interface WorkspaceHmrDeliveryContract {
  expectedDelivery?: WorkspaceHmrExpectedDelivery
  expectedFallbackReason?: string
  actualMode?: 'stateful-experimental' | 'classic'
  deliveryEvidence?: { delivery: string, reason?: string }
  classicPublication?: { files: Array<{ path: string, hash: string, size: number }>, checkedFileCount: number, transport: 'retired-410' | 'connection-refused' }
  restoreDelivery?: { delivery: string }
  repeatDelivery?: { delivery: string }
  steadyClassicImpact?: ImpactFile[]
}

/** 预期取自修改前的能力和会话模式，不能由修改后的实际回退反推。 */
export function expectedWorkspaceHmrDelivery(mode: 'standard' | 'stateful', classic: boolean, requiresClassic: boolean): WorkspaceHmrExpectedDelivery {
  return mode === 'standard' || classic ? 'classic' : requiresClassic ? 'classic-fallback' : 'stateful'
}

/** 修改语义在执行前声明回退原因；不能由实际交付或场景名称反推能力。 */
export function workspaceHmrFallbackReason(scenario: WorkspaceHmrScenarioCapability): string | undefined {
  return scenario.classicFallbackReason ?? (scenario.statefulTemplate ? 'native-registration' : undefined)
}

/** 先完成可靠增量；所有需要回退的变化保持相对顺序，后续场景持续使用 classic。 */
export function orderWorkspaceHmrScenarios<T extends WorkspaceHmrScenarioCapability>(scenarios: T[]): T[] {
  return [...scenarios.filter(scenario => !workspaceHmrFallbackReason(scenario)), ...scenarios.filter(scenario => workspaceHmrFallbackReason(scenario))]
}

/** 一次冻结整套计划，意外回退和重试都不能改变尚未执行场景的能力预期。 */
export function planWorkspaceHmrScenarios<T extends WorkspaceHmrScenarioCapability>(mode: 'standard' | 'stateful', scenarios: T[]) {
  let classic = mode === 'standard'
  return orderWorkspaceHmrScenarios(scenarios).map((scenario) => {
    const fallbackReason = workspaceHmrFallbackReason(scenario)
    const expectedDelivery = expectedWorkspaceHmrDelivery(mode, classic, Boolean(fallbackReason))
    classic ||= expectedDelivery === 'classic-fallback'
    const expectedFallbackReason = expectedDelivery === 'classic-fallback' ? fallbackReason : undefined
    return { ...scenario, expectedDelivery, expectedFallbackReason }
  })
}

export function assertWorkspaceHmrDelivery(contract: WorkspaceHmrDeliveryContract): void {
  if (contract.expectedDelivery === 'stateful' && (contract.actualMode !== 'stateful-experimental' || contract.deliveryEvidence?.delivery === 'full-reload')) {
    throw new Error('A declared stateful scenario unexpectedly switched to classic.')
  }
  if (contract.expectedDelivery === 'classic' && contract.actualMode !== 'classic') {
    throw new Error('A declared classic scenario did not remain classic.')
  }
  if (contract.expectedDelivery === 'classic-fallback' && (contract.actualMode !== 'classic'
    || !contract.expectedFallbackReason || contract.deliveryEvidence?.delivery !== 'classic' || contract.deliveryEvidence.reason !== contract.expectedFallbackReason)) {
    throw new Error('Mutation did not perform its declared capability classic fallback.')
  }
}

/** 转换保留完整物理影响；同模式门槛改验恢复与再次保存，缺证据时绝不豁免。 */
export function workspaceHmrIncrementalImpact(scenario: WorkspaceHmrDeliveryContract & { impact?: ImpactFile[] }): ImpactFile[] | undefined {
  assertWorkspaceHmrDelivery(scenario)
  if (scenario.expectedDelivery !== 'classic-fallback') {
    return scenario.impact
  }
  if (!scenario.classicPublication?.files.length || scenario.classicPublication.checkedFileCount !== scenario.classicPublication.files.length
    || !['retired-410', 'connection-refused'].includes(scenario.classicPublication.transport)
    || scenario.restoreDelivery?.delivery !== 'classic' || scenario.repeatDelivery?.delivery !== 'classic'
    || !scenario.steadyClassicImpact?.length) {
    throw new Error('Classic transition has no complete publication and same-mode restoration/repeated-save evidence.')
  }
  return scenario.steadyClassicImpact
}
