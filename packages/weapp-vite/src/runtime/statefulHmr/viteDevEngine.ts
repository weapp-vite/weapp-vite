import type * as RolldownExperimental from 'rolldown/experimental'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import * as fallbackRolldown from 'rolldown/experimental'

const require = createRequire(import.meta.url)

/** 从 Vite 的依赖位置加载配套的 Rolldown，保持原生插件与引擎属于同一模块实例。 */
export async function loadViteRolldown(): Promise<typeof RolldownExperimental> {
  try {
    const viteRequire = createRequire(require.resolve('vite/package.json'))
    const runtime = await import(pathToFileURL(viteRequire.resolve('rolldown/experimental')).href) as typeof RolldownExperimental
    if (typeof runtime.dev === 'function') {
      return runtime
    }
  }
  catch {
    // Vite 未暴露 Rolldown 时回退到 weapp-vite 自身依赖。
  }
  return fallbackRolldown
}

/** 延迟加载 Vite 使用的原生引擎，保留调用方注入引擎的同步配置接口。 */
export const createViteDevEngine: typeof RolldownExperimental.dev = async (...args) => {
  const runtime = await loadViteRolldown()
  return runtime.dev(...args)
}
