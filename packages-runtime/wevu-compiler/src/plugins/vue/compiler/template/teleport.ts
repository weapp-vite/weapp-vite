import { ROOT_PORTAL_TOP_LEVEL_TARGETS } from '@weapp-core/constants'

const ROOT_PORTAL_TOP_LEVEL_TARGET_SET = new Set<string>(ROOT_PORTAL_TOP_LEVEL_TARGETS)

export type TeleportTargetInput
  = | { kind: 'static', value: string }
    | { kind: 'dynamic' }
    | { kind: 'missing' }

export type TeleportDegradeReason
  = | 'platform'
    | 'dynamic-to'
    | 'spread'
    | 'missing-to'
    | 'empty-target'
    | 'target'

export type TeleportDecision
  = | { kind: 'map', target: string }
    | { kind: 'degrade', reason: TeleportDegradeReason, message: string }

export interface TeleportDecisionInput {
  supportsRootPortal: boolean
  to: TeleportTargetInput
  spread?: boolean
}

/**
 * Teleport 映射判定的单一事实来源，供 Vue 模板与 JSX 编译共用。
 */
export function resolveTeleportDecision(input: TeleportDecisionInput): TeleportDecision {
  if (!input.supportsRootPortal) {
    return {
      kind: 'degrade',
      reason: 'platform',
      message: '<Teleport> 当前仅在微信平台映射为 root-portal，已移除 Teleport 标签并原位渲染子节点。',
    }
  }

  if (input.to.kind === 'dynamic') {
    return {
      kind: 'degrade',
      reason: 'dynamic-to',
      message: '<Teleport> 不支持动态 :to 目标，已移除 Teleport 标签并原位渲染子节点。',
    }
  }

  if (input.to.kind === 'missing') {
    if (input.spread) {
      return {
        kind: 'degrade',
        reason: 'spread',
        message: '<Teleport> 使用了 v-bind 对象展开，无法静态读取 to 目标，已移除 Teleport 标签并原位渲染子节点。',
      }
    }
    return {
      kind: 'degrade',
      reason: 'missing-to',
      message: '<Teleport> 缺少必需的 to 属性（Vue 侧非法用法），已移除 Teleport 标签并原位渲染子节点。',
    }
  }

  const target = input.to.value.trim()
  if (!target) {
    return {
      kind: 'degrade',
      reason: 'empty-target',
      message: '<Teleport> 的 to 必须是非空静态字符串，已移除 Teleport 标签并原位渲染子节点。',
    }
  }
  if (!ROOT_PORTAL_TOP_LEVEL_TARGET_SET.has(target.toLowerCase())) {
    return {
      kind: 'degrade',
      reason: 'target',
      message: `<Teleport to="${target}"> 的传送目标在小程序中不存在，已移除 Teleport 标签并原位渲染子节点。`,
    }
  }

  return { kind: 'map', target }
}
