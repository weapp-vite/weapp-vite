import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = path.dirname(fileURLToPath(new URL(import.meta.url)))

export function createProjectCoverage(
  projectKey: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    enabled: true,
    clean: false,
    skipFull: true,
    exclude: [
      '**/dist/**',
    ],
    reportsDirectory: path.resolve(ROOT_DIR, 'coverage', projectKey),
    ...overrides,
  }
}
