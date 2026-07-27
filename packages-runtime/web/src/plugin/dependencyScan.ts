import type { ComponentEntry } from './types'
import { build } from 'esbuild'
import { extname } from 'pathe'

const SCRIPT_EXTENSIONS = new Set(['.cjs', '.js', '.jsx', '.mjs', '.ts', '.tsx'])

function isBareModuleId(id: string) {
  return Boolean(id)
    && !id.startsWith('.')
    && !id.startsWith('/')
    && !id.startsWith('#')
}

/**
 * 收集外部原生组件脚本递归依赖的裸模块，交由 Vite 预构建处理。
 */
export async function collectExternalComponentOptimizeDeps(components: ComponentEntry[]) {
  const entryPoints = Array.from(new Set(
    components
      .filter(component => component.importId && SCRIPT_EXTENSIONS.has(extname(component.script)))
      .map(component => component.script),
  ))
  if (entryPoints.length === 0) {
    return []
  }

  const result = await build({
    entryPoints,
    bundle: true,
    format: 'esm',
    logLevel: 'silent',
    metafile: true,
    outdir: 'weapp-web-dependency-scan',
    packages: 'external',
    platform: 'browser',
    write: false,
  })
  const componentImportIds = new Set(components.flatMap(component => component.importId ? [component.importId] : []))
  const dependencies = new Set<string>()
  for (const input of Object.values(result.metafile.inputs)) {
    for (const dependency of input.imports) {
      if (dependency.external
        && isBareModuleId(dependency.path)
        && !componentImportIds.has(dependency.path)) {
        dependencies.add(dependency.path)
      }
    }
  }
  return Array.from(dependencies).sort()
}
