import type { WevuRuntimeBindingManifestV1 } from '@weapp-core/constants'
import type { WatchMap } from '../register/watch'
import type {
  ComputedDefinitions,
  MethodDefinitions,
  MiniProgramComponentRawOptions,
  SetDataSnapshotOptions,
} from '../types'
import {
  WEVU_BINDING_MANIFEST_KEY,
  WEVU_SCOPED_SLOT_OWNER_REQUIRED_KEY,
  WEVU_SETUP_READY_KEY,
} from '@weapp-core/constants'
import { createApp } from '../app'
import { INTERNAL_DEFAULTS_SCOPE_KEY } from '../defaults'
import { registerComponent } from '../register'

export interface RuntimeComponentDefinitionOptions {
  scopedSlotOwnerRequired: boolean
  data: (() => Record<string, any>) | undefined
  computed: ComputedDefinitions
  methods: MethodDefinitions
  setData: SetDataSnapshotOptions | undefined
  bindingManifest?: WevuRuntimeBindingManifestV1
  watch: WatchMap | undefined
  setup: ((props: any, ctx: any) => any) | undefined
  mpOptions: MiniProgramComponentRawOptions
}

/**
 * 从稳定的组件选项快照创建独立运行时和宿主生命周期定义。
 */
export function createRuntimeComponentDefinition(
  options: RuntimeComponentDefinitionOptions,
  registerNative = false,
) {
  const hasSetupBarrier = (options.mpOptions as Record<string, unknown>)[WEVU_SETUP_READY_KEY] === false
  // 首帧标记只属于编译组件，不能让最小应用携带组件专用快照逻辑。
  const setData = hasSetupBarrier && options.setData
    ? {
        ...options.setData,
        pick: options.setData.pick?.length ? [...options.setData.pick, WEVU_SETUP_READY_KEY] : undefined,
        omit: options.setData.omit?.filter(key => key !== WEVU_SETUP_READY_KEY),
      }
    : options.setData
  const setup = hasSetupBarrier
    ? (props: any, context: any) => {
        const result = options.setup?.(props, context)
        // 普通 setup 绑定沿用现有的首快照和原生状态恢复规则，不改写用户返回值的访问器。
        context.state[WEVU_SETUP_READY_KEY] = true
        context.runtime.setupState[WEVU_SETUP_READY_KEY] = true
        return result
      }
    : options.setup
  const runtimeApp = createApp({
    data: options.data,
    computed: options.computed,
    methods: options.methods,
    setData,
    [WEVU_BINDING_MANIFEST_KEY]: options.bindingManifest,
    [WEVU_SCOPED_SLOT_OWNER_REQUIRED_KEY]: options.scopedSlotOwnerRequired,
    [INTERNAL_DEFAULTS_SCOPE_KEY]: 'component',
  } as any)
  const lifecycleDefinition = registerComponent(
    runtimeApp as any,
    options.methods,
    options.watch,
    setup,
    options.mpOptions,
    { registerNative },
  )

  return {
    lifecycleDefinition,
    runtimeApp,
  }
}
