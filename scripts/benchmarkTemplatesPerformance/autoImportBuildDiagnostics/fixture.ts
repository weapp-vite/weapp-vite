import type { BuildHookOptions } from './hooks'

export function isAutoImportBuildDiagnosticEnabled(env: Record<string, string | undefined>) {
  return env.AUTO_IMPORT_BUILD_DIAGNOSTIC === '1'
}

/** 仅修改临时 fixture；两侧加载同一驱动诊断，生产包和固定 baseline 源码不变。 */
export function injectAutoImportBuildDiagnostics(source: string, enabled: boolean, moduleUrl: string, roots: BuildHookOptions['roots']) {
  if (!enabled) {
    return source
  }
  const marker = 'plugins: ['
  if (!source.includes(marker) || source.includes('createAutoImportBuildDiagnosticsPlugin')) {
    throw new Error('Expected the original auto-import benchmark plugin list')
  }
  const imported = `import { createAutoImportBuildDiagnosticsPlugin } from ${JSON.stringify(moduleUrl)}\n`
  return imported + source.replace(marker, `${marker}\n    createAutoImportBuildDiagnosticsPlugin(true, { roots: ${JSON.stringify(roots)} }),`)
}
