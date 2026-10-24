import process from 'node:process'
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    autoRoutes: true,
    styles: [{ source: 'styles/issue-892-shared.scss', include: 'app.vue' }],
    wevu: { autoSetDataPick: true },
    hmr: { runtime: process.env.WEAPP_GITHUB_ISSUE_1015_HMR_RUNTIME || 'classic' },
  },
})
