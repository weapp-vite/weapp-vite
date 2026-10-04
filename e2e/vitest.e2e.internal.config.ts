import path from 'node:path'
import { defineConfig } from 'vitest/config'

function toPosixPath(filePath: string) {
  return filePath.replaceAll('\\', '/')
}

export default defineConfig({
  test: {
    globalSetup: [path.resolve(import.meta.dirname, 'vitest.e2e.machine.global-setup.ts')],
    taskTitleValueFormatTruncate: Number.POSITIVE_INFINITY,
    include: [
      toPosixPath(path.resolve(import.meta.dirname, './ide/runtimeErrors.test.ts')),
      toPosixPath(path.resolve(import.meta.dirname, './scripts/**/*.test.ts')),
      toPosixPath(path.resolve(import.meta.dirname, './utils/**/*.test.ts')),
    ],
    globals: true,
    environment: 'node',
  },
})
