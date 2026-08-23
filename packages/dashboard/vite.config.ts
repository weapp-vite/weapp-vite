import { resolve } from 'node:path'
import { WeappTailwindcss } from 'weapp-tailwindcss/vite'
import { createDashboardViteConfig, dashboardRoot } from './vite.shared.ts'

export default createDashboardViteConfig(WeappTailwindcss({
  // Dashboard 是 Web SPA，显式选择 generic Vite 分支，避免被 monorepo 根目录识别为小程序项目。
  appType: 'native',
  cssEntries: [resolve(dashboardRoot, 'src/style.css')],
  generator: {
    target: 'web',
  },
  logLevel: 'silent',
  tailwindcssBasedir: dashboardRoot,
}))
