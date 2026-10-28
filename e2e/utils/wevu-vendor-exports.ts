import type { Scope } from '@babel/traverse'
import type * as t from '@babel/types'
import { parse } from '@babel/parser'
import traverseModule from '@babel/traverse'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'

const traverse = (traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule
const VENDOR_EXPORT_RE = /Object\.defineProperty\(exports,\s*["']([^"']+)["']|\bexports\.([A-Za-z_$][\w$]*)\s*=/g

interface VendorMember {
  request: string
  member: string
}

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
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? undefined
  }
}

function requireRequest(node: t.Node | null | undefined, scope: Scope) {
  if (node?.type !== 'CallExpression' || node.callee.type !== 'Identifier'
    || node.callee.name !== 'require' || node.arguments.length !== 1 || scope.getBinding('require')) {
    return undefined
  }
  const request = staticKey(node.arguments[0])
  return request?.endsWith('.js') ? request : undefined
}

function collectBindingMembers(scope: Scope, name: string, request: string, usedMembers: VendorMember[]) {
  const binding = scope.getBinding(name)
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
}

/** 按真实导入和绑定收集成员，避免将 installer 返回值或同名局部变量当作模块。 */
function collectUsedVendorMembers(source: string) {
  const usedMembers: VendorMember[] = []
  traverse(parse(source, { sourceType: 'unambiguous' }), {
    'MemberExpression|OptionalMemberExpression': function (memberPath) {
      const node = memberPath.node as t.MemberExpression | t.OptionalMemberExpression
      const request = requireRequest(node.object, memberPath.scope)
      const member = staticKey(node.property, node.computed)
      if (request && member) {
        usedMembers.push({ request, member })
      }
    },
    VariableDeclarator(declarationPath) {
      // 只有完整 initializer 为 require(...) 时，变量才代表模块命名空间。
      const request = requireRequest(declarationPath.node.init, declarationPath.scope)
      if (!request) {
        return
      }
      const id = declarationPath.node.id
      if (id.type === 'Identifier') {
        collectBindingMembers(declarationPath.scope, id.name, request, usedMembers)
      }
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
    },
    ImportDeclaration(importPath) {
      const request = importPath.node.source.value
      if (!request.endsWith('.js')) {
        return
      }
      for (const specifier of importPath.node.specifiers) {
        if (specifier.type === 'ImportNamespaceSpecifier') {
          collectBindingMembers(importPath.scope, specifier.local.name, request, usedMembers)
        }
        else {
          const member = specifier.type === 'ImportDefaultSpecifier'
            ? 'default'
            : staticKey(specifier.imported, false)
          if (member) {
            usedMembers.push({ request, member })
          }
        }
      }
    },
  })
  return usedMembers
}

function isVendorPath(distRoot: string, filePath: string) {
  const relative = path.relative(distRoot, filePath).replaceAll('\\', '/')
  return relative.split('/').includes('weapp-vendors')
}

/** 收集公开 CommonJS 导出名，兼容属性赋值和 getter，不依赖打包器局部变量。 */
export function collectCommonJsExportNames(source: string) {
  const exports = new Set<string>()
  for (const match of source.matchAll(VENDOR_EXPORT_RE)) {
    const name = match[1] ?? match[2]
    if (name) {
      exports.add(name)
    }
  }
  return exports
}

async function collectVendorExports(vendorPath: string) {
  return collectCommonJsExportNames(await fs.readFile(vendorPath, 'utf8'))
}

/**
 * @description 检查小程序产物引用的 vendor 成员是否仍由对应 chunk 导出。
 */
export async function findMissingWevuVendorExports(distRoot: string) {
  const files = await fs.readdir(distRoot, { recursive: true })
  const missing = new Set<string>()
  const exportCache = new Map<string, Set<string>>()

  for (const file of files) {
    const normalizedFile = typeof file === 'string' ? file.replaceAll('\\', '/') : ''
    if (!normalizedFile || !normalizedFile.endsWith('.js')) {
      continue
    }

    const jsPath = path.join(distRoot, file)
    const source = await fs.readFile(jsPath, 'utf8')
    for (const { request, member } of collectUsedVendorMembers(source)) {
      const resolved = path.resolve(path.dirname(jsPath), request)
      if (!isVendorPath(distRoot, resolved) || !(await fs.pathExists(resolved))) {
        continue
      }
      let exports = exportCache.get(resolved)
      if (!exports) {
        exports = await collectVendorExports(resolved)
        exportCache.set(resolved, exports)
      }
      if (!exports.has(member)) {
        missing.add(`${path.relative(distRoot, resolved).replaceAll('\\', '/')}#${member}`)
      }
    }
  }

  return [...missing].sort()
}
