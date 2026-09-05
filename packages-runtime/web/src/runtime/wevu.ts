import type { RegisterMeta } from './polyfill/routeRuntime/options'
import { createApp, createWevuComponent, takePendingRuntimeAppRegistration } from 'wevu/internal-runtime'
import { registerApp, registerComponent, registerPage } from './polyfill/routeRuntime'

interface WevuRegisterMeta extends RegisterMeta {
  kind: 'app' | 'page' | 'component'
}

type RuntimeConstructorName = 'App' | 'Page' | 'Component'

function createRuntimeConstructor(meta: WevuRegisterMeta, name: RuntimeConstructorName) {
  return (definition: Record<string, any>) => {
    if (name === 'App') {
      registerApp(definition, meta)
    }
    else if (name === 'Page' || meta.kind === 'page') {
      registerPage(definition, meta)
    }
    else {
      registerComponent(definition, meta)
    }
    return definition
  }
}

function withRuntimeConstructor<T>(
  name: 'App' | 'Component',
  constructor: (options: Record<string, any>) => unknown,
  run: () => T,
) {
  const target = globalThis as Record<string, any>
  const hadOwn = Object.prototype.hasOwnProperty.call(target, name)
  const previous = target[name]
  target[name] = constructor
  try {
    return run()
  }
  finally {
    if (hadOwn) {
      target[name] = previous
    }
    else {
      delete target[name]
    }
  }
}

/**
 * 将 Wevu App 注册过程接入 Web 页面栈。
 */
export function registerWebWevuApp(options: Record<string, any>, meta: WevuRegisterMeta): void {
  const pendingRegistration = takePendingRuntimeAppRegistration()
  withRuntimeConstructor('App', definition => registerApp(definition, meta), () => {
    if (pendingRegistration) {
      pendingRegistration.register()
      return pendingRegistration.app
    }
    return createApp(options)
  })
}

/**
 * 将 Wevu 页面或组件注册过程接入 Web 自定义元素。
 */
export function registerWebWevuComponent(options: Record<string, any>, meta: WevuRegisterMeta): void {
  withRuntimeConstructor('Component', (definition) => {
    return meta.kind === 'page'
      ? registerPage(definition, meta)
      : registerComponent(definition, meta)
  }, () => createWevuComponent(options))
}

/**
 * 保留公开 Wevu 工厂行为，并使用当前模块元数据完成 Web 注册。
 */
export function registerWebWevuComponentFactory<T>(
  factory: (options: Record<string, any>) => T,
  options: Record<string, any>,
  meta: WevuRegisterMeta,
): T {
  return withRuntimeConstructor('Component', (definition) => {
    return meta.kind === 'page'
      ? registerPage(definition, meta)
      : registerComponent(definition, meta)
  }, () => factory(options))
}

/**
 * 在原生模块同步求值期间安装带页面元数据的宿主注册函数。
 */
export function installWebModuleRegistration(
  meta: WevuRegisterMeta,
  target: Record<string, any> = globalThis,
): () => void {
  const names: RuntimeConstructorName[] = meta.kind === 'app'
    ? ['App']
    : meta.kind === 'page'
      ? ['Page', 'Component']
      : ['Component']
  const previous = names.map(name => ({
    hadOwn: Object.prototype.hasOwnProperty.call(target, name),
    name,
    value: target[name],
  }))
  const installed = new Map<RuntimeConstructorName, (definition: Record<string, any>) => Record<string, any>>()

  for (const name of names) {
    const constructor = createRuntimeConstructor(meta, name)
    installed.set(name, constructor)
    target[name] = constructor
  }

  return () => {
    for (const entry of previous) {
      if (target[entry.name] !== installed.get(entry.name)) {
        continue
      }
      if (entry.hadOwn) {
        target[entry.name] = entry.value
      }
      else {
        delete target[entry.name]
      }
    }
  }
}
