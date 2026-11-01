import type { Toolchain } from '../toolchain'

/** 宿主入口只组合业务配置，Vite Plus 的元数据检查不启动构建插件。 */
export function renderHostConfig(toolchain: Toolchain, source: string, platform?: string, framework: 'native' | 'wevu' | 'react' = 'native') {
  const vitePlus = toolchain === 'vite-plus'
  const host = vitePlus ? 'vite-plus' : 'vite'
  const platformLine = platform ? `\n      platform: '${platform}',` : ''
  const webEnabled = platform ? String(platform === 'web') : 'config.weapp?.platform === \'web\''
  const qualityImports = vitePlus
    ? `import { ${framework === 'wevu' ? 'wevuRecommended' : framework === 'react' ? 'reactRecommended' : 'miniProgramRecommended'} as lint } from '@weapp-vite/oxlint'
import { recommended as fmt } from '@weapp-vite/oxfmt'
`
    : ''
  return `${qualityImports}import { defineConfig${vitePlus ? ', lazyPlugins' : ''} } from '${host}'
import { weapp } from 'weapp-vite/vite'
import base from './${source.replace(/\.ts$/, '')}'

export default defineConfig(async (env) => {
  const config = await (typeof base === 'function' ? base(env) : base)
  return {
    ...config,${vitePlus ? '\n    lint,\n    fmt,' : ''}
    weapp: {
      ...config.weapp,${platformLine}
      web: { ...config.weapp?.web, enable: ${webEnabled} },
    },
    plugins: ${vitePlus ? 'lazyPlugins(() => ' : ''}[weapp(), ...(config.plugins ?? [])]${vitePlus ? ')' : ''},
  }
})
`
}
