import type { WevuRuntimeBindingManifestV1 } from '@weapp-core/constants'
import type { WatchMap } from '../register/watch'
import type {
  ComputedDefinitions,
  MethodDefinitions,
  MiniProgramComponentRawOptions,
  SetDataSnapshotOptions,
} from '../types'
import { WEVU_BINDING_MANIFEST_KEY } from '@weapp-core/constants'
import { createApp } from '../app'
import { INTERNAL_DEFAULTS_SCOPE_KEY } from '../defaults'
import { registerComponent } from '../register'

export interface RuntimeComponentDefinitionOptions {
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
  const runtimeApp = createApp({
    data: options.data,
    computed: options.computed,
    methods: options.methods,
    setData: options.setData,
    [WEVU_BINDING_MANIFEST_KEY]: options.bindingManifest,
    [INTERNAL_DEFAULTS_SCOPE_KEY]: 'component',
  } as any)
  const lifecycleDefinition = registerComponent(
    runtimeApp as any,
    options.methods,
    options.watch,
    options.setup,
    options.mpOptions,
    { registerNative },
  )

  return {
    lifecycleDefinition,
    runtimeApp,
  }
}
