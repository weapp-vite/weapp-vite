import { REQUEST_GLOBAL_INSTALLER_MARKER } from '@weapp-core/constants'
import { parseJsLike, traverse } from '../../../../../utils/babel'

function staticValue(path: any, node: any, visited = new Set<string>()): unknown {
  if (node?.type === 'StringLiteral') {
    return node.value
  }
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value?.cooked
  }
  if (node?.type === 'Identifier' && !visited.has(node.name)) {
    visited.add(node.name)
    const binding = path.scope?.getBinding(node.name)
    if (binding?.path?.node?.type === 'VariableDeclarator') {
      return staticValue(binding.path, binding.path.node.init, visited)
    }
  }
}

function isObjectDefineProperty(node: any) {
  return node?.type === 'MemberExpression'
    && node.object?.type === 'Identifier'
    && node.object.name === 'Object'
    && node.property?.name === 'defineProperty'
}

/** 将初始化器事实收集并入调用方已有的作用域遍历。 */
export function createRequestGlobalsInstallerCollector() {
  const functions = new Set<string>()
  const marked = new Set<string>()
  const publiclyExported = new Set<string>()
  return {
    installerName: () => [...marked, ...publiclyExported].find(name => functions.has(name)) ?? null,
    visitor: {
      FunctionDeclaration(path: any) {
        if (path.node.id?.name) {
          functions.add(path.node.id.name)
        }
      },
      VariableDeclarator(path: any) {
        if (path.node.id?.type === 'Identifier' && ['FunctionExpression', 'ArrowFunctionExpression'].includes(path.node.init?.type)) {
          functions.add(path.node.id.name)
        }
      },
      ExportNamedDeclaration(path: any) {
        const node = path.node
        if (node.declaration?.type === 'FunctionDeclaration' && node.declaration.id?.name === 'installWebRuntimeGlobals') {
          publiclyExported.add(node.declaration.id.name)
        }
        for (const specifier of node.specifiers ?? []) {
          if ((specifier.exported?.name ?? specifier.exported?.value) === 'installWebRuntimeGlobals' && specifier.local?.name) {
            publiclyExported.add(specifier.local.name)
          }
        }
      },
      CallExpression(path: any) {
        const node = path.node
        if (!isObjectDefineProperty(node.callee)) {
          return
        }
        const [owner, key, descriptor] = node.arguments
        const value = staticValue(path, key)
        if (owner?.type === 'Identifier' && value === REQUEST_GLOBAL_INSTALLER_MARKER) {
          marked.add(owner.name)
        }
        if (owner?.name === 'exports' && value === 'installWebRuntimeGlobals') {
          const getter = descriptor?.properties?.find((property: any) => (property.key?.name ?? property.key?.value) === 'get')
          const getterBody = getter?.value?.body ?? getter?.body
          const returned = getterBody?.body?.find((statement: any) => statement.type === 'ReturnStatement')?.argument
          if (returned?.type === 'Identifier') {
            publiclyExported.add(returned.name)
          }
        }
      },
      AssignmentExpression(path: any) {
        const { left, right } = path.node
        if (left?.type !== 'MemberExpression') {
          return
        }
        const key = left.computed ? staticValue(path, left.property) : left.property?.name
        if (key === REQUEST_GLOBAL_INSTALLER_MARKER && left.object?.type === 'Identifier') {
          marked.add(left.object.name)
        }
        if (key === 'installWebRuntimeGlobals' && left.object?.name === 'exports' && right?.type === 'Identifier') {
          publiclyExported.add(right.name)
        }
      },
    },
  }
}

/** 通过显式运行时标记或公共导出关联定位 installer，避免依赖打包器生成的局部名字。 */
export function findRequestGlobalsInstaller(code: string): string | null {
  // 只排除缺少全部识别线索的源码；保留转义字符串、模板及标识符的完整 AST 识别。
  if (
    !code.includes(REQUEST_GLOBAL_INSTALLER_MARKER)
    && !code.includes('installWebRuntimeGlobals')
    && !code.includes('\\')
  ) {
    return null
  }

  try {
    const collector = createRequestGlobalsInstallerCollector()
    traverse(parseJsLike(code) as any, collector.visitor)
    return collector.installerName()
  }
  catch {
    return null
  }
}
