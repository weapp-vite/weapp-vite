import path from 'node:path'
import { defineConfig } from 'tsdown'

export default defineConfig({
  alias: {
    '@weapp-vite/ast/babel': path.resolve(import.meta.dirname, '../../packages/ast/src/babel.ts'),
    '@weapp-vite/ast/babelTypes': path.resolve(import.meta.dirname, '../../packages/ast/src/babelTypes.ts'),
  },
  clean: true,
  deps: {
    neverBundle: ['vscode'],
  },
  dts: false,
  entry: ['extension.ts'],
  fixedExtension: false,
  format: ['esm'],
  inputOptions(options) {
    const previousOnLog = options.onLog

    return {
      ...options,
      onLog(level, log, defaultHandler) {
        if (log.code === 'UNRESOLVED_IMPORT' && typeof log.message === 'string' && log.message.includes(`'vscode'`)) {
          return
        }

        previousOnLog?.(level, log, defaultHandler)

        if (!previousOnLog) {
          defaultHandler(level, log)
        }
      },
    }
  },
  outDir: 'dist',
  platform: 'node',
  tsconfig: 'tsconfig.json',
})
