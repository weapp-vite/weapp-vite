import * as t from '@babel/types'
import MagicString from 'magic-string'
import path from 'pathe'
import { parseJsLike, traverse } from '../../../utils/babel'
import { toPosixPath } from '../../../utils/path'

export function rewriteRelativeImportSource(source: string, fromDir: string, tempDir: string) {
  if (!source.startsWith('.')) {
    return source
  }
  const abs = path.resolve(fromDir, source)
  let next = toPosixPath(path.relative(tempDir, abs))
  if (!next.startsWith('.')) {
    next = `./${next}`
  }
  return next
}

export function rewriteJsLikeImportsForTempDir(source: string, fromDir: string, tempDir: string) {
  const ast = parseJsLike(source)
  const ms = new MagicString(source)
  let mutated = false

  const rewriteLiteral = (node: any, originalSource: string) => {
    if (!originalSource || !originalSource.startsWith('.')) {
      return
    }
    const next = rewriteRelativeImportSource(originalSource, fromDir, tempDir)
    const start = node?.start
    const end = node?.end
    if (typeof start === 'number' && typeof end === 'number') {
      ms.overwrite(start, end, JSON.stringify(next))
      mutated = true
    }
  }

  traverse(ast, {
    ImportDeclaration(p: any) {
      const sourceNode = p.node?.source
      if (sourceNode && t.isStringLiteral(sourceNode)) {
        rewriteLiteral(sourceNode, sourceNode.value)
      }
    },
    ExportNamedDeclaration(p: any) {
      const sourceNode = p.node?.source
      if (sourceNode && t.isStringLiteral(sourceNode)) {
        rewriteLiteral(sourceNode, sourceNode.value)
      }
    },
    ExportAllDeclaration(p: any) {
      const sourceNode = p.node?.source
      if (sourceNode && t.isStringLiteral(sourceNode)) {
        rewriteLiteral(sourceNode, sourceNode.value)
      }
    },
    CallExpression(p: any) {
      const callee = p.node?.callee
      if (!callee) {
        return
      }

      const arg0 = p.node?.arguments?.[0]
      if (!arg0 || !t.isStringLiteral(arg0)) {
        return
      }

      if (t.isImport(callee)) {
        rewriteLiteral(arg0, arg0.value)
        return
      }

      if (t.isIdentifier(callee, { name: 'require' })) {
        rewriteLiteral(arg0, arg0.value)
      }
    },
  })

  return mutated ? ms.toString() : source
}
