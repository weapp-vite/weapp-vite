import type { StatefulHmrOutputFile } from './outputWriter'
import { parseJsLike, traverse } from '../../utils/babel'

/** 为已输出但尚未执行的模块保留宿主 chunk 加载入口，避免重导出优化丢失 HMR 依赖。 */
export function registerStatefulHmrInitialChunkLoaders(output: StatefulHmrOutputFile[], subPackageRoots: string[]): void {
  const runtime = output.find(item => item.type === 'chunk' && item.fileName === 'rolldown-runtime.js')
  if (!runtime || runtime.type !== 'chunk') {
    return
  }
  const registrations: string[] = []
  const importedChunks = new Set(output.flatMap(item => item.type === 'chunk' ? item.imports ?? [] : []))
  for (const chunk of output) {
    if (chunk.type !== 'chunk' || chunk === runtime || chunk.isEntry !== false || importedChunks.has(chunk.fileName)
      || subPackageRoots.some(packageRoot => chunk.fileName.startsWith(`${packageRoot.replace(/\/$/, '')}/`))) {
      continue
    }
    const ids: string[] = []
    traverse(parseJsLike(chunk.code), {
      CallExpression({ node }) {
        if (node.callee.type === 'MemberExpression' && !node.callee.computed && node.callee.object.type === 'Identifier'
          && node.callee.object.name === '__rolldown_runtime__' && node.callee.property.type === 'Identifier'
          && node.callee.property.name === 'registerModule' && node.arguments[0]?.type === 'StringLiteral') {
          ids.push(node.arguments[0].value)
        }
      },
    })
    if (ids.length) {
      const specifier = `./${chunk.fileName.replaceAll('\\', '/')}`
      registrations.push(`{ const chunk = { ids: ${JSON.stringify(ids)}, loading: false, load: () => require(${JSON.stringify(specifier)}) }; for (const id of chunk.ids) __rolldown_runtime__.initialChunkLoaders.set(id, chunk); }`)
    }
  }
  runtime.code += `\n${registrations.join('\n')}\n`
}
