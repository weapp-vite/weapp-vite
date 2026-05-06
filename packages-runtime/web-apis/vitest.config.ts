import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PACKAGE_DIR = __dirname

export default defineProject({
  test: {
    globals: true,
    environment: 'node',
    include: [path.join(PACKAGE_DIR, 'test/**/*.test.ts')],
    coverage: createProjectCoverage('packages-runtime/web-apis', {
      include: [path.join(PACKAGE_DIR, 'src/**/*.ts')],
    }),
  },
})
