import type { Scope } from '@babel/traverse'
import type * as t from '@babel/types'
import { parse } from '@babel/parser'
import traverseModule from '@babel/traverse'
import path from 'pathe'

const traverse = (traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule

type PublicationSnapshot = ReadonlyMap<string, string>

function staticKey(node: t.Node | null | undefined, computed = true): string | undefined {
  if (!node) {
    return undefined
  }
  if (!computed && node.type === 'Identifier') {
    return node.name
  }
  if (node.type === 'StringLiteral' || node.type === 'NumericLiteral') {
    return String(node.value)
  }
  if (node.type === 'TemplateLiteral' && !node.expressions.length) {
    return node.quasis[0]?.value.cooked ?? undefined
  }
}

function vendorRequest(node: t.Node | null | undefined, scope: Scope) {
  if (node?.type !== 'CallExpression' || node.callee.type !== 'Identifier'
    || node.callee.name !== 'require' || node.arguments.length !== 1 || scope.getBinding('require')) {
    return undefined
  }
  const request = staticKey(node.arguments[0])
  return request?.includes('weapp-vendors/') && request.endsWith('.js') ? request : undefined
}

function collectUsedVendorMembers(source: string) {
  const usedMembers: Array<{ request: string, member: string }> = []
  const ast = parse(source, { sourceType: 'unambiguous' })
  traverse(ast, {
    MemberExpression(memberPath) {
      const request = vendorRequest(memberPath.node.object, memberPath.scope)
      const member = staticKey(memberPath.node.property, memberPath.node.computed)
      if (request && member) {
        usedMembers.push({ request, member })
      }
    },
    VariableDeclarator(declarationPath) {
      const request = vendorRequest(declarationPath.node.init, declarationPath.scope)
      if (!request) {
        return
      }
      const id = declarationPath.node.id
      if (id.type === 'ObjectPattern') {
        for (const property of id.properties) {
          if (property.type !== 'ObjectProperty') {
            continue
          }
          const member = staticKey(property.key, property.computed)
          if (member) {
            usedMembers.push({ request, member })
          }
        }
      }
      if (id.type !== 'Identifier') {
        return
      }
      const binding = declarationPath.scope.getBinding(id.name)
      for (const reference of binding?.referencePaths ?? []) {
        const parent = reference.parentPath
        if ((!parent?.isMemberExpression() && !parent?.isOptionalMemberExpression()) || parent.node.object !== reference.node) {
          continue
        }
        const member = staticKey(parent.node.property, parent.node.computed)
        if (member) {
          usedMembers.push({ request, member })
        }
      }
    },
  })
  return usedMembers
}

function collectVendorExports(source: string) {
  const exports = new Set<string>()
  traverse(parse(source, { sourceType: 'unambiguous' }), {
    CallExpression(callPath) {
      const { callee, arguments: args } = callPath.node
      if (callee.type !== 'MemberExpression' || callee.object.type !== 'Identifier'
        || callee.object.name !== 'Object' || staticKey(callee.property, callee.computed) !== 'defineProperty'
        || args[0]?.type !== 'Identifier' || args[0].name !== 'exports'
        || callPath.scope.getBinding('Object') || callPath.scope.getBinding('exports')) {
        return
      }
      const name = staticKey(args[1])
      if (name) {
        exports.add(name)
      }
    },
  })
  return exports
}

/** 只检查同一快照中的真实引用；按 Babel binding 区分同名变量及字符串、注释。 */
export function inspectVendorMembers(snapshot: PublicationSnapshot, distRoot: string) {
  const missingByFile: Record<string, string[]> = {}
  const exportCache = new Map<string, Set<string>>()
  let referencedMembers = 0
  for (const [file, source] of snapshot) {
    if (file.startsWith('weapp-vendors/') || file.includes('/weapp-vendors/')) {
      continue
    }
    const missing = new Set<string>()
    for (const { request, member } of collectUsedVendorMembers(source)) {
      referencedMembers++
      const resolved = path.relative(distRoot, path.resolve(distRoot, path.dirname(file), request)).replaceAll('\\', '/')
      const vendorSource = snapshot.get(resolved)
      if (vendorSource === undefined) {
        missing.add(`${resolved}#${member} (module missing)`)
        continue
      }
      let exports = exportCache.get(resolved)
      if (!exports) {
        exports = collectVendorExports(vendorSource)
        exportCache.set(resolved, exports)
      }
      if (!exports.has(member)) {
        missing.add(`${resolved}#${member}`)
      }
    }
    if (missing.size) {
      missingByFile[file] = [...missing].sort()
    }
  }
  return { missingByFile, referencedMembers }
}
