import type * as t from '@babel/types'
import type { StatefulHmrOutputFile } from './outputWriter'
import { parseJsLike, traverse } from '../../utils/babel'
import { StatefulHmrRuntimeCompatibilityError } from './commonRuntime'

function isRuntimeRequire(node: t.Node | null | undefined): boolean {
  return node?.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require'
    && node.arguments[0]?.type === 'StringLiteral' && node.arguments[0].value === './rolldown-runtime.js'
}

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
  if (!registrations.length) {
    return
  }
  const app = output.find(item => item.type === 'chunk' && item.fileName === 'app.js')
  if (!app || app.type !== 'chunk') {
    throw new StatefulHmrRuntimeCompatibilityError('stateful HMR 孤立 chunk 加载入口缺少 app.js。')
  }
  const runtimeImport = parseJsLike(app.code).program.body.find(statement => (
    (statement.type === 'ExpressionStatement' && isRuntimeRequire(statement.expression))
    || (statement.type === 'VariableDeclaration' && statement.declarations.some(declaration => isRuntimeRequire(declaration.init)))
  ))
  if (runtimeImport?.end == null) {
    throw new StatefulHmrRuntimeCompatibilityError('stateful HMR app.js 缺少共享 runtime 的顶层 require，无法注册孤立 chunk。')
  }
  // 由应用入口持有加载器，保持静态 require 依赖单向，避免 runtime 与 facade 互相依赖。
  app.code = `${app.code.slice(0, runtimeImport.end)}\n${registrations.join('\n')}\n${app.code.slice(runtimeImport.end)}`
}
