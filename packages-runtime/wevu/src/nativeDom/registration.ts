/* eslint-disable ts/no-use-before-define -- 编译入口工厂置前，注册实现在后。 */
import type { ComponentOptions } from '@vue/runtime-core'
import type { NativeDomRendererMode } from '@weapp-core/shared/native-dom'
import type { MiniProgramPageLike } from '../routerInternal/shared'
import type { NativePageContext, NativeRender, WevuOptions } from './component'
import { createRenderer } from '@vue/runtime-core'
import { WEVU_INLINE_MAP_KEY, WEVU_LEGACY_RENDERER_KEY, WEVU_NATIVE_DOM_COMPONENT_KEY } from '@weapp-core/constants'
import { selectNativeDom } from '@weapp-core/shared/native-dom'
import { createWevuComponent, createWevuComponentDefinition, getWevuComponentLifecycleDefinition } from '../runtime/define'
import { callHookReturn } from '../runtime/hooks/base'
import { cancelInitialNavigation, ensureInitialNavigation } from '../runtime/navigationLifecycle'
import { markNoSetData } from '../runtime/noSetData'
import { registerNativeComponentDefinition } from '../runtime/register/component/registerNativeDefinition'
import { createNativeComponent, getNativeTarget, nativePageContextKey } from './component'
import { createHost } from './host'

export interface NativeComponentConfig {
  mode: NativeDomRendererMode
  platform: string
  isPage: boolean
  templateComputedBindings?: string[]
}

type PageHost = MiniProgramPageLike & Record<string, any> & { __webviewId__?: number }

/** 保留一份脚本选项，逻辑入口可注册 legacy 宿主，父组件可直接消费虚拟组件。 */
export function withNativeDom(options: WevuOptions, render: NativeRender, config: NativeComponentConfig, components: Record<string, ComponentOptions> = {}): ComponentOptions {
  const nativeOptions: WevuOptions = { ...options, components: { ...components, ...options.components } }
  const templateOptions: [string, readonly string[]][] = [
    ['computed', config.templateComputedBindings ?? []],
    ['methods', [WEVU_INLINE_MAP_KEY]],
  ]
  for (const [key, removed] of templateOptions) {
    if (nativeOptions[key] && typeof nativeOptions[key] === 'object') {
      const remaining: Record<string, unknown> = {}
      for (const [name, value] of Object.entries(nativeOptions[key])) {
        if (!removed.includes(name)) {
          remaining[name] = value
        }
      }
      if (Object.keys(remaining).length) {
        nativeOptions[key] = remaining
      }
      else {
        delete nativeOptions[key]
      }
    }
  }
  const component = createNativeComponent(nativeOptions, render)
  Object.defineProperty(component, WEVU_NATIVE_DOM_COMPONENT_KEY, {
    value: () => register(component, options, config),
  })
  return markNoSetData(component)
}

function register(component: ComponentOptions, options: WevuOptions, config: NativeComponentConfig) {
  if (!config.isPage) {
    createWevuComponent(options)
    return
  }
  const legacy = getWevuComponentLifecycleDefinition(createWevuComponentDefinition(options))!
  const sessions = new WeakMap<PageHost, {
    mode?: 'legacy' | 'native-dom'
    closed?: boolean
    loading?: boolean
    pending: Array<() => void>
    app?: ReturnType<ReturnType<typeof createRenderer>['createApp']>
    target?: ReturnType<typeof getNativeTarget>
    cleanup?: () => void
  }>()
  const sessionFor = (host: PageHost) => {
    let session = sessions.get(host)
    if (!session) {
      session = { pending: [] }
      sessions.set(host, session)
    }
    return session
  }
  const dispatch = (host: PageHost, name: string, args: any[], fallback?: (...args: any[]) => any) => {
    const session = sessionFor(host)
    if (session.closed) {
      return
    }
    if (!session.mode && (name === 'onUnload' || name === 'detached')) {
      session.closed = true
      session.pending.length = 0
      return
    }
    if (session.loading && name !== 'onUnload' && name !== 'detached') {
      session.pending.push(() => dispatch(host, name, args, fallback))
      return
    }
    if (!session.mode && name !== 'onLoad') {
      session.pending.push(() => dispatch(host, name, args, fallback))
      return
    }
    if (!session.mode) {
      const selection = selectNativeDom(config, host, 'wevu')
      if (selection) {
        session.mode = 'native-dom'
        session.loading = true
        const { root, options: hostOptions, cleanup } = createHost(selection)
        const app = createRenderer(hostOptions).createApp(component, { ...host.properties, ...args[0] })
        session.app = app
        app.config.throwUnhandledErrorInProduction = true
        const context: NativePageContext = { host: host as any, query: args[0] ?? {}, cleanups: new Set() }
        session.cleanup = () => {
          for (const dispose of context.cleanups) {
            dispose()
          }
          cleanup()
        }
        app.provide(nativePageContextKey, context)
        const mount = (shouldMount: boolean) => {
          if (session.closed) {
            return
          }
          session.loading = false
          if (!shouldMount) {
            session.closed = true
            session.pending.length = 0
            session.cleanup?.()
            session.app = undefined
            return
          }
          try {
            app.mount(root)
            session.target = getNativeTarget(app._instance)
          }
          catch (error) {
            session.closed = true
            session.pending.length = 0
            session.cleanup?.()
            session.app = undefined
            throw error
          }
          for (const replay of session.pending.splice(0)) {
            replay()
          }
        }
        const navigation = ensureInitialNavigation(host, args[0], { onComplete: mount })
        if (navigation) {
          return navigation
        }
        mount(true)
      }
      else {
        session.mode = 'legacy'
        host.setData({ [WEVU_LEGACY_RENDERER_KEY]: true })
      }
      for (const replay of session.pending.splice(0)) {
        replay()
      }
    }
    if (session.mode === 'legacy') {
      return fallback?.apply(host, args)
    }
    if (name === 'onUnload' || name === 'detached') {
      session.closed = true
      session.pending.length = 0
      cancelInitialNavigation(host)
      try {
        session.app?.unmount()
      }
      finally {
        session.cleanup?.()
        session.app = undefined
        session.target = undefined
      }
      return
    }
    // setup 与 Vue 提交边界已派发这些生命周期，不能重复调用。
    if (name === 'onLoad' || name === 'ready' || name === 'onReady' || name === 'created' || name === 'attached') {
      return
    }
    if (session.target) {
      const result = callHookReturn(session.target, name, args)
      const userHook = options[name]
      return result ?? (typeof userHook === 'function' ? userHook.apply(host, args) : undefined)
    }
  }
  const wrap = (record: Record<string, any> | undefined, onlyPageHooks = false) => {
    const result: Record<string, any> = {}
    for (const [name, value] of Object.entries(record ?? {})) {
      if (onlyPageHooks && !name.startsWith('on')) {
        continue
      }
      result[name] = typeof value === 'function'
        ? function (this: PageHost, ...args: any[]) { return dispatch(this, name, args, value) }
        : value
    }
    return result
  }
  const definition = {
    ...legacy,
    ...wrap(legacy, true),
    data: { ...legacy.data, [WEVU_LEGACY_RENDERER_KEY]: false },
    lifetimes: wrap(legacy.lifetimes),
    pageLifetimes: wrap(legacy.pageLifetimes),
    observers: wrap(legacy.observers),
    methods: { ...legacy.methods, ...wrap(legacy.methods, true) },
  }
  registerNativeComponentDefinition(definition, true)
}
