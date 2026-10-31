import type { Options as RolldownDtsOptions } from 'rolldown-plugin-dts'

/** 将旧版顶层选项归入 tsc，新配置优先，并保留声明编译的隔离与 Vue 分工。 */
export function normalizeRolldownDtsOptions(options: RolldownDtsOptions = {}): RolldownDtsOptions {
  const { build, incremental, parallel, eager, newContext: _newContext, vue: _vue, tsc, ...shared } = options
  return {
    ...shared,
    tsc: {
      ...tsc,
      build: tsc?.build ?? build,
      incremental: tsc?.incremental ?? incremental,
      parallel: tsc?.parallel ?? parallel,
      eager: tsc?.eager ?? eager,
      // 每轮使用独立上下文，Vue 入口继续由 weapp-vite 的专用流程处理。
      newContext: true,
      vue: false,
    },
  }
}
