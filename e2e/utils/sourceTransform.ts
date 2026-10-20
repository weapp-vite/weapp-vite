import type { Plugin } from 'vite'
import { createFilter, transformWithOxc } from 'vite'

/** 仅供通过 `oxc.exclude` 停用内建转换的 Node E2E 入口使用，保留已解析选项并跳过应用生成的 tsconfig。 */
export function createE2ESourceTransform(): Plugin {
  const filter = createFilter(/\.(m?ts|[jt]sx)$/, /\.js$/)
  let transformOptions: NonNullable<Parameters<typeof transformWithOxc>[2]> = {}

  return {
    name: 'weapp-vite:e2e-source-transform',
    apply: 'serve',
    configResolved(config) {
      if (config.oxc === false) {
        throw new Error('E2E source transform requires Oxc options and its runtime resolver to remain enabled.')
      }
      if (config.oxc.jsxInject || config.oxc.jsxRefreshInclude || config.oxc.jsxRefreshExclude
        || (typeof config.oxc.jsx === 'object' && config.oxc.jsx.refresh)) {
        throw new Error('E2E source transform does not support JSX injection or refresh.')
      }
      const options = { ...config.oxc }
      delete options.include
      delete options.exclude
      delete options.jsxInject
      delete options.jsxRefreshInclude
      delete options.jsxRefreshExclude
      transformOptions = options
    },
    applyToEnvironment(environment) {
      if (environment.config.isBundled) {
        throw new Error('E2E source transform requires an unbundled Vitest environment.')
      }
      return true
    },
    async transform(code, id) {
      if (!filter(id) && !filter(id.replace(/[?#].*$/, ''))) {
        return
      }
      const result = await transformWithOxc(code, id, {
        ...transformOptions,
        tsconfig: false,
        sourcemap: this.environment.mode !== 'build' || !!this.environment.config.build.sourcemap,
      })
      for (const warning of result.warnings) {
        this.warn(warning)
      }
      return { code: result.code, map: result.map, moduleType: 'js' }
    },
  }
}
