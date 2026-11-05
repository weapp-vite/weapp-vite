import { defineConfig } from 'tsdown'
import { workspaceSourceAliases } from './scripts/workspaceSourceAliases.ts'

export default defineConfig({
  alias: Object.fromEntries(Object.entries(workspaceSourceAliases).map(([specifier, replacement]) => [`${specifier}$`, replacement])),
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

        if (log.code === 'UNRESOLVED_IMPORT') {
          defaultHandler('error', log)
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
