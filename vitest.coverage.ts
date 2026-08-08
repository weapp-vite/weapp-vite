import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = path.dirname(fileURLToPath(new URL(import.meta.url)))

export const FULL_COVERAGE_THRESHOLDS = Object.freeze({
  lines: 100,
  statements: 100,
  functions: 100,
  branches: 100,
  perFile: true,
})

export function isStrictWebCoverageEnabled() {
  return process.env.WEAPP_VITE_WEB_COVERAGE_STRICT === '1'
}

export function createProjectCoverage(
  projectKey: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    enabled: true,
    clean: false,
    skipFull: true,
    reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
    exclude: [
      '**/dist/**',
    ],
    reportsDirectory: path.resolve(ROOT_DIR, 'coverage', projectKey),
    ...(isStrictWebCoverageEnabled() ? { thresholds: FULL_COVERAGE_THRESHOLDS } : {}),
    ...overrides,
  }
}
