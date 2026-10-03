import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { findDependencyPaths } from './graph.mjs'

export const auditPath = ['weapp-vite', 'weapp-tailwindcss', '@mpxjs/webpack-plugin', '@mpxjs/utils', '@mpxjs/core', '@mpxjs/api-proxy', 'axios']
export const watchedPackages = ['weapp-tailwindcss', '@weapp-tailwindcss/engine', '@weapp-vite/web', '@weapp-vite/mcp', '@weapp-vite/miniprogram-automator', '@mpxjs/webpack-plugin', '@mpxjs/api-proxy', 'axios']

/** 比较完整构建输出的字节，避免 hook 改变功能结果后仍计算加载成本。 */
export async function inventoryOutput(root) {
  const files = []
  for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) {
      continue
    }
    const file = path.join(entry.parentPath, entry.name)
    const content = await readFile(file)
    files.push({ file: path.relative(root, file).replaceAll('\\', '/'), bytes: content.byteLength, sha256: createHash('sha256').update(content).digest('hex') })
  }
  return files.sort((a, b) => a.file.localeCompare(b.file))
}

export function buildConsumerSummary(graph, trace) {
  assert(trace?.schemaVersion === 1 && trace.instrumented === true && trace.exitCode === 0, 'Missing successful instrumented build trace')
  assert(Array.isArray(trace.modules) && trace.modules.some(module => module.loaded && module.package === 'weapp-vite'), 'Trace did not observe the actual weapp-vite build entry')
  assert(Array.isArray(trace.edges), 'Missing module resolution edges')
  const requiredMissing = graph.edges.filter(edge => !edge.to && !edge.optional)
  assert(requiredMissing.length === 0, `Installed graph has unresolved required dependencies: ${requiredMissing.map(edge => edge.name).join(', ')}`)
  const packages = graph.nodes.filter(node => node.id !== '.').map((node) => {
    const modules = trace.modules.filter(module => module.packageRoot === node.id)
    return { ...node, resolvedModules: modules.filter(module => module.resolved).length, loadedModules: modules.filter(module => module.loaded).length, loadedFileBytes: modules.filter(module => module.loaded).reduce((sum, module) => sum + module.bytes, 0) }
  })
  return {
    packages,
    watched: watchedPackages.map(name => ({ name, installed: packages.filter(pkg => pkg.name === name) })),
    historicalAuditPath: { names: auditPath, installedPaths: findDependencyPaths(graph, auditPath) },
    missingOptionalDependencies: graph.edges.filter(edge => !edge.to && edge.optional),
    loadedFileBytes: trace.modules.filter(module => module.loaded).reduce((sum, module) => sum + module.bytes, 0),
    limitations: [
      'Installed dependency paths and successful main-process module loads are separate observations.',
      'A resolved module need not be loaded; a loaded module does not prove a particular function or vulnerable code executed.',
      'Bundled internals, Rolldown native reads and child-process module loads are outside the Node hook trace.',
      'No dependency topology optimization, exploitability or installation-size reduction is asserted.',
    ],
  }
}
