import path from 'node:path'
import vue from '@vitejs/plugin-vue'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const simulatorRoot = import.meta.dirname
const demoWebRoot = path.resolve(simulatorRoot, '../../demos/web')
const mpcoreRoot = path.resolve(simulatorRoot, '../..')

export default defineConfig({
  root: demoWebRoot,
  plugins: [vue()],
  server: {
    fs: {
      allow: [mpcoreRoot],
    },
  },
  test: {
    include: [path.resolve(simulatorRoot, './e2e/browser.e2e.test.ts')],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    globals: true,
    fileParallelism: false,
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [
        {
          browser: 'chromium',
        },
      ],
    },
  },
})
