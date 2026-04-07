import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: true,
  deps: {
    neverBundle: ['vscode'],
  },
  dts: false,
  entry: ['extension.ts'],
  fixedExtension: false,
  format: ['cjs'],
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
