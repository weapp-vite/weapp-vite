import type * as RolldownExperimental from 'rolldown/experimental'
import { loadHostRolldown } from '../viteHost/engine'

/** 从 Vite 宿主加载配套的 Rolldown，保持原生插件与引擎属于同一模块实例。 */
export const loadViteRolldown = loadHostRolldown

/** 延迟加载 Vite 使用的原生引擎，保留调用方注入引擎的同步配置接口。 */
export const createViteDevEngine: typeof RolldownExperimental.dev = async (...args) => {
  const runtime = await loadViteRolldown()
  return runtime.dev(...args)
}
