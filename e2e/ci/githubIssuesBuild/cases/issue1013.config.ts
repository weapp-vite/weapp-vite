import { mergeConfig } from 'vite'
import { defineConfig } from 'weapp-vite'
import baseConfig from '../../../../e2e-apps/github-issues/weapp-vite.config'

export default defineConfig(mergeConfig(baseConfig, {
  build: {
    outDir: 'dist-issue-1013',
  },
}))
