import type * as t from '@babel/types'
import type { AstEngineName } from '../types'
import { parseJsLike, traverse } from '../../utils/babel'

interface PageScrollInspection {
  empty: boolean
  hasSetDataCall: boolean
  syncApis: Set<string>
}

function isStaticPropertyName(key: t.Expression | t.Identifier | t.PrivateName): string | undefined {
  if (key.type === 'Identifier') {
    return key.name
  }
  if (key.type === 'StringLiteral') {
    return key.value
  }
  return undefined
}

function getMemberExpressionPropertyName(node: t.MemberExpression | t.OptionalMemberExpression): string | undefined {
  if (node.computed) {
    return node.property.type === 'StringLiteral' ? node.property.value : undefined
  }
  return node.property.type === 'Identifier' ? node.property.name : undefined
}

function isOnPageScrollCallee(
  callee: t.Expression | t.V8IntrinsicIdentifier,
  hookNames: Set<string>,
  namespaceImports: Set<string>,
): boolean {
  if (callee.type === 'Identifier') {
    return hookNames.has(callee.name)
  }

  if (callee.type === 'MemberExpression' || callee.type === 'OptionalMemberExpression') {
    const object = callee.object
    const propName = getMemberExpressionPropertyName(callee)
    return object.type === 'Identifier'
      && namespaceImports.has(object.name)
      && propName === 'onPageScroll'
  }

  return false
}

function getCallExpressionCalleeName(
  callee: t.Expression | t.V8IntrinsicIdentifier,
): string | undefined {
  if (callee.type === 'Identifier') {
    return callee.name
  }
  if (callee.type === 'MemberExpression' || callee.type === 'OptionalMemberExpression') {
    return getMemberExpressionPropertyName(callee)
  }
  return undefined
}

function collectPageScrollInspection(
  functionPath: any,
  node: t.ArrowFunctionExpression | t.FunctionExpression | t.ObjectMethod,
): PageScrollInspection {
  const inspection: PageScrollInspection = {
    empty: node.body.type === 'BlockStatement' && node.body.body.length === 0,
    hasSetDataCall: false,
    syncApis: new Set<string>(),
  }

  functionPath.traverse({
    Function(innerPath: any) {
      if (innerPath !== functionPath) {
        innerPath.skip()
      }
    },
    CallExpression(callPath: any) {
      const callee = callPath.node.callee as t.Expression | t.V8IntrinsicIdentifier
      const calleeName = getCallExpressionCalleeName(callee)
      if (calleeName === 'setData') {
        inspection.hasSetDataCall = true
      }
      if (callee.type === 'MemberExpression' || callee.type === 'OptionalMemberExpression') {
        const object = callee.object
        if (object.type === 'Identifier' && object.name === 'wx') {
          const propertyName = getMemberExpressionPropertyName(callee)
          if (propertyName && propertyName.endsWith('Sync')) {
            inspection.syncApis.add(`wx.${propertyName}`)
          }
        }
      }
    },
    OptionalCallExpression(callPath: any) {
      const callee = callPath.node.callee as t.Expression | t.V8IntrinsicIdentifier
      const calleeName = getCallExpressionCalleeName(callee)
      if (calleeName === 'setData') {
        inspection.hasSetDataCall = true
      }
      if (callee.type === 'MemberExpression' || callee.type === 'OptionalMemberExpression') {
        const object = callee.object
        if (object.type === 'Identifier' && object.name === 'wx') {
          const propertyName = getMemberExpressionPropertyName(callee)
          if (propertyName && propertyName.endsWith('Sync')) {
            inspection.syncApis.add(`wx.${propertyName}`)
          }
        }
      }
    },
  })

  return inspection
}

function createWarningPrefix(filename: string, line?: number, column?: number): string {
  const pos = typeof line === 'number' && typeof column === 'number'
    ? `${line}:${column}`
    : '?:?'
  return `[weapp-vite][onPageScroll] ${filename}:${pos}`
}

/**
 * 静态检测 onPageScroll 中的常见性能风险并返回告警文案。
 */
export function collectOnPageScrollPerformanceWarnings(
  code: string,
  filename: string,
  _options?: {
    engine?: AstEngineName
  },
): string[] {
  let ast: t.File
  try {
    ast = parseJsLike(code)
  }
  catch {
    return []
  }

  const onPageScrollHookNames = new Set<string>(['onPageScroll'])
  const namespaceImports = new Set<string>()
  for (const statement of ast.program.body) {
    if (statement.type !== 'ImportDeclaration' || statement.source.value !== 'wevu') {
      continue
    }
    for (const specifier of statement.specifiers) {
      if (
        specifier.type === 'ImportSpecifier'
        && specifier.imported.type === 'Identifier'
        && specifier.imported.name === 'onPageScroll'
      ) {
        onPageScrollHookNames.add(specifier.local.name)
      }
      if (specifier.type === 'ImportNamespaceSpecifier') {
        namespaceImports.add(specifier.local.name)
      }
    }
  }

  const warnings: string[] = []
  const warningSet = new Set<string>()
  const addWarning = (warning: string) => {
    if (warningSet.has(warning)) {
      return
    }
    warningSet.add(warning)
    warnings.push(warning)
  }

  const reportInspection = (
    functionPath: any,
    node: t.ArrowFunctionExpression | t.FunctionExpression | t.ObjectMethod,
    sourceLabel: string,
  ) => {
    const inspection = collectPageScrollInspection(functionPath, node)
    const line = node.loc?.start.line
    const column = typeof node.loc?.start.column === 'number' ? node.loc.start.column + 1 : undefined
    const prefix = createWarningPrefix(filename, line, column)
    if (inspection.empty) {
      addWarning(`${prefix} 检测到空的 ${sourceLabel} 回调，建议移除无效监听以降低滚动时调度开销。`)
    }
    if (inspection.hasSetDataCall) {
      addWarning(`${prefix} 检测到 ${sourceLabel} 内调用 setData，建议改用节流、IntersectionObserver 或合并更新。`)
    }
    for (const syncApi of inspection.syncApis) {
      addWarning(`${prefix} 检测到 ${sourceLabel} 内调用同步 API（${syncApi}），可能阻塞渲染线程。`)
    }
  }

  traverse(ast as any, {
    ObjectMethod(path: any) {
      const keyName = isStaticPropertyName(path.node.key)
      if (keyName !== 'onPageScroll') {
        return
      }
      reportInspection(path, path.node, 'onPageScroll')
    },
    ObjectProperty(path: any) {
      if (path.node.computed) {
        return
      }
      const keyName = isStaticPropertyName(path.node.key as any)
      if (keyName !== 'onPageScroll') {
        return
      }
      const value = path.node.value
      if (value.type !== 'FunctionExpression' && value.type !== 'ArrowFunctionExpression') {
        return
      }
      reportInspection(path.get('value'), value, 'onPageScroll')
    },
    CallExpression(path: any) {
      if (!isOnPageScrollCallee(path.node.callee, onPageScrollHookNames, namespaceImports)) {
        return
      }
      const arg0 = path.node.arguments[0]
      if (!arg0 || arg0.type === 'SpreadElement') {
        return
      }
      if (arg0.type !== 'FunctionExpression' && arg0.type !== 'ArrowFunctionExpression') {
        return
      }
      reportInspection(path.get('arguments.0'), arg0, 'onPageScroll(...)')
    },
    OptionalCallExpression(path: any) {
      if (!isOnPageScrollCallee(path.node.callee, onPageScrollHookNames, namespaceImports)) {
        return
      }
      const arg0 = path.node.arguments[0]
      if (!arg0 || arg0.type === 'SpreadElement') {
        return
      }
      if (arg0.type !== 'FunctionExpression' && arg0.type !== 'ArrowFunctionExpression') {
        return
      }
      reportInspection(path.get('arguments.0'), arg0, 'onPageScroll(...)')
    },
  })

  return warnings
}
