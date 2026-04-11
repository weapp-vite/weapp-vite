import type { RuntimeApp, WevuPlugin } from './types'
import {
  WEVU_IS_APP_INSTANCE_KEY,
  WEVU_RUNTIME_APP_KEY,
} from '@weapp-core/constants'
import { getCurrentInstance } from './hooks'

function resolveCurrentRuntimeApp(): RuntimeApp<any, any, any> {
  const instance = getCurrentInstance() as {
    [WEVU_IS_APP_INSTANCE_KEY]?: boolean
    [WEVU_RUNTIME_APP_KEY]?: RuntimeApp<any, any, any>
  } | undefined

  if (instance?.[WEVU_IS_APP_INSTANCE_KEY] && instance[WEVU_RUNTIME_APP_KEY]) {
    return instance[WEVU_RUNTIME_APP_KEY]
  }

  throw new Error('defineAppSetup() / use() 只能在 app setup 上下文中调用')
}

/**
 * 在 `app` 级 `setup()` 中显式获取运行时 app，提供与 `app.use()` / `app.provide()` 对齐的 SFC 写法。
 */
export function defineAppSetup<T>(setup: (app: RuntimeApp<any, any, any>) => T): T {
  return setup(resolveCurrentRuntimeApp())
}

/**
 * 在 `app` 级 `setup()` 中安装插件，提供与 `app.use()` 对齐的 SFC 调用方式。
 */
export function use(plugin: WevuPlugin, ...options: any[]) {
  return resolveCurrentRuntimeApp().use(plugin, ...options)
}
