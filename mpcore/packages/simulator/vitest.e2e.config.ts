import path from 'node:path'
import process from 'node:process'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import { createStatefulNativeComponentFiles } from './test/helpers/statefulNativeComponent'
import { createStatefulVueComponentFiles } from './test/helpers/statefulVueComponent'

const simulatorRoot = import.meta.dirname
const demoWebRoot = path.resolve(simulatorRoot, '../../demos/web')
const mpcoreRoot = path.resolve(simulatorRoot, '../..')

export default defineConfig({
  root: demoWebRoot,
  oxc: {
    tsconfig: false,
  },
  optimizeDeps: {
    rolldownOptions: {
      // Vite 的依赖扫描不继承 oxc 配置，避免扫描无关应用的 solution references。
      tsconfig: false,
    },
  },
  plugins: [vue(), tailwindcss(), {
    name: 'stateful-native-component-fixture',
    resolveId(id) {
      if (id === 'virtual:stateful-native-component-fixture' || id === 'virtual:stateful-vue-component-fixture') {
        return `\0${id}`
      }
    },
    async load(id) {
      if (id === '\0virtual:stateful-native-component-fixture') {
        return `export default ${JSON.stringify(createStatefulNativeComponentFiles())}`
      }
      if (id === '\0virtual:stateful-vue-component-fixture') {
        return `export default ${JSON.stringify(await createStatefulVueComponentFiles())}`
      }
    },
  }],
  server: {
    fs: {
      allow: [mpcoreRoot, path.resolve(simulatorRoot, '../../../e2e/utils/requestClientsRealWebSocketProbe.ts'), path.resolve(simulatorRoot, '../../../e2e-apps/github-issues/src/pages/css-nested-vars')],
    },
  },
  test: {
    attachmentsDir: path.resolve(simulatorRoot, '../../../docs/reports/simulator-browser'),
    include: [path.resolve(simulatorRoot, './e2e/**/*.e2e.test.ts').replaceAll('\\', '/')],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    globals: true,
    fileParallelism: false,
    browser: {
      enabled: true,
      provider: playwright({
        launchOptions: process.env.WEAPP_VITE_WEB_E2E_CHANNEL
          ? { channel: process.env.WEAPP_VITE_WEB_E2E_CHANNEL }
          : undefined,
      }),
      headless: true,
      instances: [
        {
          browser: 'chromium',
        },
      ],
    },
  },
})
