import path from 'node:path'
import { defineConfig } from 'tsdown'

export default defineConfig({
  alias: {
    '@weapp-vite/language-service': path.resolve(import.meta.dirname, '../../packages/language-service/src/index.ts'),
    '@weapp-vite/ast/babelTypes': path.resolve(import.meta.dirname, '../../packages/ast/src/babelTypes.ts'),
    '@weapp-vite/ast/babel': path.resolve(import.meta.dirname, 'extension/languages/ast.ts'),
    '@weapp-vite/ast': path.resolve(import.meta.dirname, 'extension/languages/ast.ts'),
  },
  clean: true,
  deps: {
    resolveDepSubpath: true,
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
