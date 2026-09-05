import type { SetDataSchedulerOptions } from './app/setData/scheduler'
import type { InlineExpressionMap } from './register/inline'
import type { ComputedDefinitions, InternalRuntimeState, MethodDefinitions, RuntimeInstance, SetDataSnapshotOptions } from './types'

export type { SetDataSchedulerOptions } from './app/setData/scheduler'

export type RuntimeCapabilityName
  = | 'patchStrategy'
    | 'templateRefs'
    | 'inlineEvents'
    | 'setDataHighFrequencyWarning'
    | 'scopedSlots'
    | 'layout'

export interface TemplateRefBinding {
  selector: string
  inFor: boolean
  name?: string
  get?: () => unknown
  kind?: 'component' | 'element'
}

export interface LayoutHostBinding {
  key: string
  refName?: string
  selector: string
  kind?: 'component'
}

export interface HighFrequencyWarningMonitorOptions {
  option: SetDataSnapshotOptions['highFrequencyWarning']
  targetLabel: string
  isInPageScrollHook?: () => boolean
  now?: () => number
  logger?: (message: string) => void
}

export const RUNTIME_SCOPED_SLOT_STATE_KEY = '__wevuScopedSlotMountState'

export interface SetDataScheduler {
  job: () => void | Promise<void>
  snapshot: () => Record<string, unknown>
  cloneLatestSnapshot: () => Record<string, unknown>
  start?: () => void
  dispose?: () => void
}

export interface ScopedSlotMountState {
  ownerId: string
  shouldFlushNativeOwnerId: boolean
}

type RuntimeStateWithScopedSlotMount = InternalRuntimeState & {
  [RUNTIME_SCOPED_SLOT_STATE_KEY]?: ScopedSlotMountState
}

/**
 * 读取能力实现挂在宿主实例上的作用域插槽挂载状态。
 */
export function getScopedSlotMountState(target: InternalRuntimeState): ScopedSlotMountState | undefined {
  return (target as RuntimeStateWithScopedSlotMount)[RUNTIME_SCOPED_SLOT_STATE_KEY]
}

export interface RuntimeCapabilityRegistry {
  patchStrategy?: {
    createScheduler: (options: SetDataSchedulerOptions) => SetDataScheduler
  }
  templateRefs?: {
    attachBindings: (target: InternalRuntimeState, bindings: readonly TemplateRefBinding[]) => void
    hasBindings: (target: InternalRuntimeState) => boolean
    schedule: (target: InternalRuntimeState, onResolved?: () => void, assignmentTarget?: InternalRuntimeState) => void
    scheduleOwner: (target: InternalRuntimeState) => void
    clear: (target: InternalRuntimeState, assignmentTarget?: InternalRuntimeState) => void
  }
  inlineEvents?: {
    handler: (this: InternalRuntimeState, event: unknown) => unknown
    run: (context: unknown, expression: unknown, event: unknown, map?: InlineExpressionMap) => unknown
  }
  setDataHighFrequencyWarning?: {
    createMonitor: (options: HighFrequencyWarningMonitorOptions) => (() => void) | undefined
  }
  scopedSlots?: {
    prepareMount: (target: InternalRuntimeState) => ScopedSlotMountState
    attachMount: <D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
      target: InternalRuntimeState,
      runtime: RuntimeInstance<D, C, M>,
      state: ScopedSlotMountState,
      deferSnapshot: boolean,
    ) => void
    refresh: (target: InternalRuntimeState, state: ScopedSlotMountState) => void
    syncNativeOwnerId: (target: InternalRuntimeState, state: ScopedSlotMountState) => void
    teardown: (target: InternalRuntimeState) => void
    resolveLifecycleProxy: (target: InternalRuntimeState) => unknown
    allocateOwnerId: () => string
  }
  layout?: {
    attachPageSetter: (target: InternalRuntimeState) => void
    attachHosts: (bindings: readonly LayoutHostBinding[], target: InternalRuntimeState) => void
    detachHosts: (bindings: readonly LayoutHostBinding[], target: InternalRuntimeState) => void
  }
}

const mutableRuntimeCapabilityRegistry: RuntimeCapabilityRegistry = {}

/**
 * 运行时能力的只读实时视图。安装器直接替换对应槽位，核心路径不会复制能力清单。
 */
export const runtimeCapabilityRegistry: Readonly<RuntimeCapabilityRegistry> = mutableRuntimeCapabilityRegistry

/**
 * 注册或热替换一个运行时能力实现。
 */
export function registerRuntimeCapability<Name extends RuntimeCapabilityName>(
  name: Name,
  implementation: NonNullable<RuntimeCapabilityRegistry[Name]>,
): void {
  if (mutableRuntimeCapabilityRegistry[name] === implementation) {
    return
  }
  mutableRuntimeCapabilityRegistry[name] = implementation
}

/**
 * 读取调用方明确请求的能力；缺失时同步失败，禁止静默降级。
 */
export function requireRuntimeCapability<Name extends RuntimeCapabilityName>(
  name: Name,
  requester: string,
): NonNullable<RuntimeCapabilityRegistry[Name]> {
  const implementation = mutableRuntimeCapabilityRegistry[name]
  if (!implementation) {
    throw new Error(`[wevu] runtime capability "${name}" is required by ${requester}; install it before registration`)
  }
  return implementation
}

/**
 * 判断 setData 高频告警是否被显式启用。
 */
export function isSetDataHighFrequencyWarningRequested(
  option: SetDataSnapshotOptions['highFrequencyWarning'],
): boolean {
  if (option === true) {
    return true
  }
  if (!option || typeof option !== 'object' || Array.isArray(option)) {
    return false
  }
  return option.enabled !== false
}
