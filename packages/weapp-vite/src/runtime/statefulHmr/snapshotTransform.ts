import type { OxcOptions, Plugin, ResolvedConfig } from 'vite'
import { createFilter, transformWithOxc } from 'vite'

/** 受管配置尚未生成时，沿用公开转换入口并显式禁用 TS 配置发现。 */
export function createSnapshotTransformPlugin(options: OxcOptions): Plugin {
  const { include, exclude, jsxInject, jsxRefreshInclude, jsxRefreshExclude, ...transformOptions } = options
  const filter = createFilter(include ?? /\.(m?ts|[jt]sx)$/, exclude ?? /\.js$/)
  const refreshFilter = jsxRefreshInclude || jsxRefreshExclude ? createFilter(jsxRefreshInclude, jsxRefreshExclude) : undefined
  let config: ResolvedConfig
  return {
    name: 'weapp-vite:snapshot-managed-tsconfig-transform',
    configResolved(resolved) {
      config = resolved
    },
    async transform(code, id) {
      const filename = id.replace(/[?#].*$/, '')
      if (!filter(id) && !filter(filename) && !refreshFilter?.(id)) {
        return null
      }
      const jsx = typeof transformOptions.jsx === 'string'
        ? transformOptions.jsx
        : { development: !config.isProduction, ...transformOptions.jsx }
      if (typeof jsx === 'object' && jsx.refresh) {
        const importSource = jsx.importSource ?? 'react'
        if (this.environment.config.consumer === 'server'
          || (refreshFilter && !refreshFilter(id))
          || (!filename.endsWith('x') && !code.includes(`${importSource}/jsx-runtime`) && !code.includes(`${importSource}/jsx-dev-runtime`))) {
          jsx.refresh = false
        }
      }
      const result = await transformWithOxc(code, id, {
        ...transformOptions,
        jsx,
        ...(refreshFilter?.(id) && !/\.[cm]?[jt]sx?$/.test(filename) ? { lang: 'js' as const } : {}),
        tsconfig: false,
        sourcemap: Boolean(this.environment.config.build.sourcemap),
      }, undefined, config)
      for (const warning of result.warnings) {
        this.warn(warning)
      }
      return {
        code: jsxInject && /\.[jt]sx$/.test(filename) ? `${jsxInject};${result.code}` : result.code,
        map: result.map,
        moduleType: 'js',
      }
    },
  }
}
