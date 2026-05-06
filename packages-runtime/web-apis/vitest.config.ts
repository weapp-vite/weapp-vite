import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '../..')

export default defineProject({
  root: ROOT_DIR,
  test: {
    globals: true,
    environment: 'node',
    include: ['packages-runtime/web-apis/test/**/*.test.ts'],
    globalSetup: [path.resolve(ROOT_DIR, 'vitest.globalSetup.ts')],
    coverage: createProjectCoverage('packages-runtime/web-apis', {
      include: ['packages-runtime/web-apis/src/**/*.ts'],
    }),
  },
})
