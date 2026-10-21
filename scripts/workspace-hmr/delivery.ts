import type { ImpactFile } from './types'

export type WorkspaceHmrExpectedDelivery = 'stateful' | 'classic' | 'classic-fallback'

export interface WorkspaceHmrDeliveryContract {
  expectedDelivery?: WorkspaceHmrExpectedDelivery
  actualMode?: 'stateful-experimental' | 'classic'
  deliveryEvidence?: { delivery: string, reason?: string }
  classicPublication?: { files: Array<{ path: string, hash: string, size: number }>, checkedFileCount: number, transport: 'retired-410' | 'connection-refused' }
  restoreDelivery?: { delivery: string }
  repeatDelivery?: { delivery: string }
  steadyClassicImpact?: ImpactFile[]
}

/** 预期取自修改前的能力和会话模式，不能由修改后的实际回退反推。 */
export function expectedWorkspaceHmrDelivery(mode: 'standard' | 'stateful', classic: boolean, changesCompiledTemplate: boolean): WorkspaceHmrExpectedDelivery {
  return mode === 'standard' || classic ? 'classic' : changesCompiledTemplate ? 'classic-fallback' : 'stateful'
}

/** 支持的增量必须先完成，避免单向回退提前遮蔽脚本和样式覆盖。 */
export function orderWorkspaceHmrScenarios<T extends { statefulTemplate?: boolean }>(scenarios: T[]): T[] {
  return [...scenarios.filter(scenario => !scenario.statefulTemplate), ...scenarios.filter(scenario => scenario.statefulTemplate)]
}

/** 一次冻结整套计划，意外回退和重试都不能改变尚未执行场景的能力预期。 */
export function planWorkspaceHmrScenarios<T extends { statefulTemplate?: boolean }>(mode: 'standard' | 'stateful', scenarios: T[]) {
  let classic = mode === 'standard'
  return orderWorkspaceHmrScenarios(scenarios).map((scenario) => {
    const expectedDelivery = expectedWorkspaceHmrDelivery(mode, classic, Boolean(scenario.statefulTemplate))
    classic ||= expectedDelivery === 'classic-fallback'
    return { ...scenario, expectedDelivery }
  })
}

export function assertWorkspaceHmrDelivery(contract: WorkspaceHmrDeliveryContract): void {
  if (contract.expectedDelivery === 'stateful' && contract.actualMode !== 'stateful-experimental') {
    throw new Error('A declared stateful scenario unexpectedly switched to classic.')
  }
  if (contract.expectedDelivery === 'classic' && contract.actualMode !== 'classic') {
    throw new Error('A declared classic scenario did not remain classic.')
  }
  if (contract.expectedDelivery === 'classic-fallback' && (contract.actualMode !== 'classic'
    || contract.deliveryEvidence?.delivery !== 'classic' || contract.deliveryEvidence.reason !== 'native-registration')) {
    throw new Error('Compiled template mutation did not perform its declared native-registration classic fallback.')
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
