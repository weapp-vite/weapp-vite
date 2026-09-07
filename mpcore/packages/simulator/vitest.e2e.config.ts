import path from 'node:path'
import process from 'node:process'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const simulatorRoot = import.meta.dirname
const demoWebRoot = path.resolve(simulatorRoot, '../../demos/web')
const mpcoreRoot = path.resolve(simulatorRoot, '../..')

export default defineConfig({
  root: demoWebRoot,
  oxc: {
    tsconfig: false,
  },
  plugins: [vue(), tailwindcss()],
  server: {
    fs: {
      allow: [mpcoreRoot, path.resolve(simulatorRoot, '../../../e2e/utils/requestClientsRealWebSocketProbe.ts')],
    },
  },
  test: {
    attachmentsDir: path.resolve(simulatorRoot, '../../../docs/reports/simulator-browser'),
    include: [
      path.resolve(simulatorRoot, './e2e/browser.e2e.test.ts'),
      path.resolve(simulatorRoot, './e2e/omittedApp.e2e.test.ts'),
      path.resolve(simulatorRoot, './e2e/pageReady.e2e.test.ts'),
      path.resolve(simulatorRoot, './e2e/logManager.e2e.test.ts'),
      path.resolve(simulatorRoot, './e2e/requestMocks.e2e.test.ts'),
      path.resolve(simulatorRoot, './e2e/instanceProperties.e2e.test.ts'),
      path.resolve(simulatorRoot, './e2e/customTabBar.e2e.test.ts'),
      path.resolve(simulatorRoot, './e2e/globalState.e2e.test.ts'),
      path.resolve(simulatorRoot, './e2e/selectors.e2e.test.ts'),
      path.resolve(simulatorRoot, './e2e/nativeComponentProperties.e2e.test.ts'),
      path.resolve(simulatorRoot, './e2e/npmModules.e2e.test.ts'),
      path.resolve(simulatorRoot, './e2e/componentTransitions.e2e.test.ts'),
      path.resolve(simulatorRoot, './e2e/pageIdentity.e2e.test.ts'),
      path.resolve(simulatorRoot, './e2e/componentEventTargets.e2e.test.ts'),
      path.resolve(simulatorRoot, './e2e/webSocketTranscript.e2e.test.ts'),
    ],
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
