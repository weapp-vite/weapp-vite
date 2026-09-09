import { mergeConfig } from 'vite'
import { defineConfig } from 'weapp-vite'
import baseConfig from '../../../../e2e-apps/github-issues/weapp-vite.config'

export default defineConfig(mergeConfig(baseConfig, {
  build: {
    minify: false,
  },
  weapp: {
    // Sass URL 回归仍使用真实 App SFC，只构建一个原生页面，避免全库路由挤占初始构建预算。
    autoRoutes: {
      include: ['pages/block-slot/**'],
    },
    hmr: {
      runtime: 'stateful-experimental',
    },
    npm: {
      enable: false,
    },
    styles: {
      source: 'styles/issue-892-app.scss',
      include: 'app.vue',
    },
  },
}))
