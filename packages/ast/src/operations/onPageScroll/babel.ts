import type * as t from '@babel/types'
import type { PageScrollInspection } from './types'
import { parseJsLike, traverse } from '../../babel'
import {
  createWarningPrefix,
  getCallExpressionCalleeName,
  getMemberExpressionPropertyName,
  getOnPageScrollCallbackArgument,
  isOnPageScrollCallee,
  isStaticPropertyName,
} from './shared'

export function collectPageScrollInspection(
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

export function collectOnPageScrollWarningsWithBabel(
  code: string,
  filename: string,
): string[] {
  const ast = parseJsLike(code)
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
      const arg0 = getOnPageScrollCallbackArgument(path.node)
      if (!arg0) {
        return
      }
      reportInspection(path.get('arguments.0'), arg0, 'onPageScroll(...)')
    },
    OptionalCallExpression(path: any) {
      if (!isOnPageScrollCallee(path.node.callee, onPageScrollHookNames, namespaceImports)) {
        return
      }
      const arg0 = getOnPageScrollCallbackArgument(path.node)
      if (!arg0) {
        return
      }
      reportInspection(path.get('arguments.0'), arg0, 'onPageScroll(...)')
    },
  })

  return warnings
}
