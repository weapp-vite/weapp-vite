import type {
  ComponentPropsOptions,
  ComputedDefinitions,
  DefineComponentOptions,
  MethodDefinitions,
  MiniProgramComponentRawOptions,
} from './types'
import { isReactive, isRef, toRaw } from '../reactivity'
import { createApp } from './app'
import { applyWevuComponentDefaults, INTERNAL_DEFAULTS_SCOPE_KEY } from './defaults'
import { registerComponent, runSetupFunction } from './register'
import { getOwnerProxy, getOwnerSnapshot, subscribeOwner } from './scopedSlots'

/**
 * defineComponent 返回的组件定义描述，用于手动注册或高级用法。
 */
export interface ComponentDefinition<
  D extends object,
  C extends ComputedDefinitions,
  M extends MethodDefinitions,
> {
  /**
   * 内部 runtime app（高级能力使用），不对外暴露正式 API。
   * @internal
   */
  __wevu_runtime: import('./types').RuntimeApp<D, C, M>

  /**
   * 内部选项快照（高级能力使用），包含 data/computed/methods 等。
   * @internal
   */
  __wevu_options: {
    data: () => D
    computed: C
    methods: M
    setData: import('./types').SetDataSnapshotOptions | undefined
    watch: Record<string, any> | undefined
    setup: DefineComponentOptions<ComponentPropsOptions, D, C, M>['setup']
    mpOptions: MiniProgramComponentRawOptions
  }
}

/**
 * 按 Vue 3 风格定义一个小程序组件/页面。
 *
 * - 统一注册为 `Component()`
 *
 * @param options 组件定义项
 * @returns 可手动注册的组件定义
 *
 * @example
 * ```ts
 * defineComponent({
 *   data: () => ({ count: 0 }),
 *   setup() {
 *     onMounted(() => console.log('mounted'))
 *   }
 * })
 * ```
 *
 * @example
 * ```ts
 * defineComponent({
 *   setup() {
 *     onPageScroll(() => {})
 *   }
 * })
 * ```
 */
export function defineComponent<
  P extends ComponentPropsOptions = ComponentPropsOptions,
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
>(options: DefineComponentOptions<P, D, C, M>): ComponentDefinition<D, C, M> {
  ensureScopedSlotComponentGlobal()
  const resolvedOptions = applyWevuComponentDefaults(options)
  const {
    data,
    computed,
    methods,
    setData,
    watch,
    setup,
    props,
    ...mpOptions
  } = resolvedOptions

  const runtimeApp = createApp<D, C, M>({
    data,
    computed,
    methods,
    setData,
    [INTERNAL_DEFAULTS_SCOPE_KEY]: 'component',
  })

  // 对 setup 的包装：注入 props/context 后应用到 runtime/state/methods
  const setupWrapper = (ctx: any) => {
    const result = runSetupFunction(setup, ctx?.props ?? {}, ctx)
    if (result) {
      applySetupResult(ctx.runtime, ctx.instance, result)
    }
  }

  // 保存供手动注册使用的选项
  const mpOptionsWithProps = normalizeProps(mpOptions, props)

  const componentOptions = {
    data: data as () => D,
    computed: computed as C,
    methods: methods as M,
    setData,
    watch,
    setup: setupWrapper,
    mpOptions: mpOptionsWithProps,
  }

  registerComponent<D, C, M>(runtimeApp, methods ?? {}, watch as any, setupWrapper, mpOptionsWithProps)

  // 返回组件定义，便于外部自行注册
  return {
    __wevu_runtime: runtimeApp,
    __wevu_options: componentOptions,
  }
}

function applySetupResult(runtime: any, _target: any, result: any) {
  const methods = runtime?.methods ?? Object.create(null)
  const state = runtime?.state ?? Object.create(null)
  const rawState = isReactive(state) ? toRaw(state) : state
  if (runtime && !runtime.methods) {
    try {
      runtime.methods = methods
    }
    catch {
      // 若 runtime 被标记只读则忽略（保持兼容）
    }
  }
  if (runtime && !runtime.state) {
    try {
      runtime.state = state
    }
    catch {
      // 若 runtime 被标记只读则忽略（保持兼容）
    }
  }
  Object.keys(result).forEach((key) => {
    const val = (result as any)[key]
    if (typeof val === 'function') {
      ;(methods as any)[key] = (...args: any[]) => (val as any).apply(runtime?.proxy ?? runtime, args)
    }
    else {
      // 在 script setup / setup() 中可能会把当前小程序实例（getCurrentInstance()）等非可序列化对象返回出来。
      // 这些对象不应进入 setData 快照（否则可能导致深度遍历 + 栈溢出），但仍允许在 JS 侧读取。
      if (val === _target || !shouldExposeInSnapshot(val)) {
        try {
          Object.defineProperty(rawState, key, {
            value: val,
            configurable: true,
            enumerable: false,
            writable: true,
          })
        }
        catch {
          ;(state as any)[key] = val
        }
      }
      else {
        ;(state as any)[key] = val
      }
    }
  })
  if (runtime) {
    runtime.methods = runtime.methods ?? methods
    runtime.state = runtime.state ?? state
  }
}

function isPlainObject(value: unknown): value is Record<string, any> {
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

function shouldExposeInSnapshot(value: unknown): boolean {
  if (value == null) {
    return true
  }
  if (typeof value !== 'object') {
    return true
  }
  if (isRef(value) || isReactive(value)) {
    return true
  }
  if (Array.isArray(value)) {
    return true
  }
  return isPlainObject(value)
}

/**
 * 从 Vue SFC 选项创建 wevu 组件，供 weapp-vite 编译产物直接调用的兼容入口。
 *
 * @param options 组件选项，可能包含小程序特有的 properties
 */
export function createWevuComponent<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  options: DefineComponentOptions<ComponentPropsOptions, D, C, M> & { properties?: WechatMiniprogram.Component.PropertyOption },
): void {
  ensureScopedSlotComponentGlobal()
  const {
    properties,
    props,
    ...restOptions
  } = options

  // 将 properties 合并到 mpOptions，保持小程序属性定义
  const finalOptions = normalizeProps(restOptions, props, properties)

  // 调用 defineComponent 完成注册
  defineComponent(finalOptions)
}

function decodeWxmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, '\'')
    .replace(/&#39;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function parseInlineArgs(event: any) {
  const argsRaw = event?.currentTarget?.dataset?.wvArgs ?? event?.target?.dataset?.wvArgs
  let args: any[] = []
  if (typeof argsRaw === 'string') {
    try {
      args = JSON.parse(argsRaw)
    }
    catch {
      try {
        args = JSON.parse(decodeWxmlEntities(argsRaw))
      }
      catch {
        args = []
      }
    }
  }
  if (!Array.isArray(args)) {
    args = []
  }
  return args.map((item: any) => item === '$event' ? event : item)
}

export function createWevuScopedSlotComponent(
  overrides?: { computed?: ComputedDefinitions },
): void {
  const normalizeSlotBindings = (value: unknown): Record<string, any> => {
    if (!value || typeof value !== 'object') {
      return {}
    }
    if (Array.isArray(value)) {
      const result: Record<string, any> = {}
      for (let i = 0; i < value.length; i += 2) {
        const key = value[i]
        if (typeof key === 'string' && key) {
          result[key] = value[i + 1]
        }
      }
      return result
    }
    return value as Record<string, any>
  }

  const mergeSlotProps = (
    instance: any,
    override?: { __wvSlotScope?: unknown, __wvSlotProps?: unknown },
  ) => {
    const scopeSource = Object.prototype.hasOwnProperty.call(override ?? {}, '__wvSlotScope')
      ? (override as any).__wvSlotScope
      : instance?.properties?.__wvSlotScope
    const propsSource = Object.prototype.hasOwnProperty.call(override ?? {}, '__wvSlotProps')
      ? (override as any).__wvSlotProps
      : instance?.properties?.__wvSlotProps
    const scope = normalizeSlotBindings(scopeSource)
    const slotProps = normalizeSlotBindings(propsSource)
    const merged = { ...scope, ...slotProps }
    if (typeof instance?.setData === 'function') {
      instance.setData({ __wvSlotPropsData: merged })
    }
  }

  const baseOptions = {
    properties: {
      __wvOwnerId: { type: String, value: '' },
      __wvSlotProps: {
        type: null,
        value: null,
        observer(this: any, next: unknown) {
          mergeSlotProps(this, { __wvSlotProps: next })
        },
      },
      __wvSlotScope: {
        type: null,
        value: null,
        observer(this: any, next: unknown) {
          mergeSlotProps(this, { __wvSlotScope: next })
        },
      },
    },
    data: () => ({
      __wvOwner: {},
      __wvSlotPropsData: {},
    }),
    lifetimes: {
      attached(this: any) {
        const ownerId = this.properties?.__wvOwnerId ?? ''
        mergeSlotProps(this)
        if (!ownerId) {
          return
        }
        const updateOwner = (snapshot: Record<string, any>, proxy: any) => {
          this.__wvOwnerProxy = proxy
          if (typeof this.setData === 'function') {
            this.setData({ __wvOwner: snapshot || {} })
          }
        }
        this.__wvOwnerUnsub = subscribeOwner(ownerId, updateOwner)
        const snapshot = getOwnerSnapshot(ownerId)
        if (snapshot) {
          updateOwner(snapshot, getOwnerProxy(ownerId))
        }
      },
      detached(this: any) {
        if (typeof this.__wvOwnerUnsub === 'function') {
          this.__wvOwnerUnsub()
        }
        this.__wvOwnerUnsub = undefined
        this.__wvOwnerProxy = undefined
      },
    },
    methods: {
      __weapp_vite_owner(this: any, event: any) {
        const handlerName = event?.currentTarget?.dataset?.wvHandler ?? event?.target?.dataset?.wvHandler
        if (typeof handlerName !== 'string' || !handlerName) {
          return undefined
        }
        const owner = this.__wvOwnerProxy
        const handler = owner?.[handlerName]
        if (typeof handler !== 'function') {
          return undefined
        }
        const args = parseInlineArgs(event)
        return handler.apply(owner, args)
      },
    },
  }

  if (overrides?.computed && Object.keys(overrides.computed).length > 0) {
    ;(baseOptions as any).computed = overrides.computed
  }

  createWevuComponent(baseOptions as any)
}

ensureScopedSlotComponentGlobal()

function ensureScopedSlotComponentGlobal() {
  const globalObject = typeof globalThis !== 'undefined' ? globalThis : undefined
  if (!globalObject) {
    return
  }
  const globalRecord = globalObject as Record<string, any>
  if (!globalRecord.__weapp_vite_createScopedSlotComponent) {
    globalRecord.__weapp_vite_createScopedSlotComponent = createWevuScopedSlotComponent
  }
}

function normalizeProps(
  baseOptions: Record<string, any>,
  props?: ComponentPropsOptions,
  explicitProperties?: WechatMiniprogram.Component.PropertyOption,
) {
  const baseProperties = (baseOptions as any).properties
  const resolvedExplicit = explicitProperties
    ?? (baseProperties && typeof baseProperties === 'object' ? (baseProperties as any) : undefined)
  const attachInternalProps = (source?: Record<string, any>) => {
    const next = { ...(source ?? {}) }
    if (!Object.prototype.hasOwnProperty.call(next, '__wvSlotOwnerId')) {
      next.__wvSlotOwnerId = { type: String, value: '' }
    }
    if (!Object.prototype.hasOwnProperty.call(next, '__wvSlotScope')) {
      next.__wvSlotScope = { type: null, value: null }
    }
    return next
  }

  if (resolvedExplicit || !props) {
    const { properties: _ignored, ...rest } = baseOptions
    return {
      ...rest,
      properties: attachInternalProps(resolvedExplicit as any),
    }
  }

  const properties: Record<string, any> = {}
  Object.entries(props).forEach(([key, definition]) => {
    if (definition === null || definition === undefined) {
      return
    }
    if (Array.isArray(definition) || typeof definition === 'function') {
      properties[key] = { type: definition }
      return
    }
    if (typeof definition === 'object') {
      // 在 Vue <script setup> 中，defineModel() 会生成 `xxxModifiers: {}` 作为 props 兜底，
      // 在小程序 properties 中需要一个可用的类型声明，避免空对象导致属性定义异常。
      if (key.endsWith('Modifiers') && Object.keys(definition).length === 0) {
        properties[key] = { type: Object, value: {} }
        return
      }
      const propOptions: Record<string, any> = {}
      if ('type' in definition && definition.type !== undefined) {
        propOptions.type = (definition as any).type
      }
      const defaultValue = 'default' in definition ? (definition as any).default : (definition as any).value
      if (defaultValue !== undefined) {
        propOptions.value = typeof defaultValue === 'function' ? (defaultValue as any)() : defaultValue
      }
      properties[key] = propOptions
    }
  })

  return {
    ...baseOptions,
    properties: attachInternalProps(properties),
  }
}
