import type { Plugin, RolldownPluginOption } from 'rolldown'

/**
 * DevEngine 的增量 transform 可在首次 buildEnd 后重新启用 Sass 编译器。
 * 完整重建先释放旧池再建立新池，引擎终结时再次释放当前池。
 */
export async function bindStatefulCssShutdown(option: RolldownPluginOption): Promise<RolldownPluginOption> {
  const resolved = await option
  if (Array.isArray(resolved)) {
    return Promise.all(resolved.map(bindStatefulCssShutdown))
  }
  if (!resolved || !('name' in resolved) || resolved.name !== 'vite:css' || !('buildEnd' in resolved) || !resolved.buildEnd) {
    return resolved
  }
  const plugin = resolved as Plugin
  const buildStart = typeof plugin.buildStart === 'function' ? plugin.buildStart : plugin.buildStart?.handler
  const buildEnd = typeof plugin.buildEnd === 'function' ? plugin.buildEnd : plugin.buildEnd!.handler
  const closeBundle = typeof plugin.closeBundle === 'function' ? plugin.closeBundle : plugin.closeBundle?.handler
  const resetPool: Plugin['buildStart'] = buildStart
    ? {
        ...typeof plugin.buildStart === 'object' ? plugin.buildStart : {},
        sequential: true,
        async handler(options) {
          // Vite 的原 hook 会覆盖池闭包；先关闭上代，且不能让并行 hook 在期间重开旧池。
          await buildEnd.call(this)
          await buildStart.call(this, options)
        },
      }
    : plugin.buildStart
  return {
    ...plugin,
    buildStart: resetPool,
    closeBundle: {
      order: 'post',
      sequential: true,
      async handler(error) {
        const failures: unknown[] = []
        try {
          await closeBundle?.call(this, error)
        }
        catch (failure) {
          failures.push(failure)
        }
        try {
          await buildEnd.call(this, error)
        }
        catch (failure) {
          failures.push(failure)
        }
        if (failures.length) {
          throw failures.length === 1 ? failures[0] : new AggregateError(failures, 'Vite CSS 引擎终结与预处理池释放均失败。', { cause: failures[0] })
        }
      },
    },
  } satisfies Plugin
}
