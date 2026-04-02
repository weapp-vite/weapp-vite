import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '../..')

export default defineProject({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: [path.resolve(ROOT_DIR, 'vitest.globalSetup.ts')],
    coverage: createProjectCoverage('packages-runtime/web-apis'),
  },
})
