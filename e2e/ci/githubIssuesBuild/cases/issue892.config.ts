import { mergeConfig } from 'vite'
import { defineConfig } from 'weapp-vite'
import baseConfig from '../../../../e2e-apps/github-issues/weapp-vite.config'

export default defineConfig(mergeConfig(baseConfig, {
  build: {
    minify: false,
    outDir: 'dist-issue-892',
  },
  weapp: {
    styles: {
      source: 'styles/issue-892-app.scss',
      include: 'app.vue',
    },
  },
}))
