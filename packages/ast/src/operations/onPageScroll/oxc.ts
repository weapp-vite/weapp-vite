import type { PageScrollInspection } from './types'
import { parseJsLikeWithEngine } from '../../engine'
import {
  createLineStartOffsets,
  createWarningPrefix,
  getLocationFromOffset,
  getOxcCallExpressionCalleeName,
  getOxcMemberExpressionPropertyName,
  getOxcStaticPropertyName,
  isOxcFunctionLike,
  isOxcOnPageScrollCallee,
} from './shared'

export function collectPageScrollInspectionWithOxc(node: any): PageScrollInspection {
  const inspection: PageScrollInspection = {
    empty: node.body?.type === 'BlockStatement' && node.body.body.length === 0,
    hasSetDataCall: false,
    syncApis: new Set<string>(),
  }

  const root = node.body?.type === 'BlockStatement' ? node.body : node.body

  function visit(current: any, allowNestedFunctions = false) {
    if (!current) {
      return
    }

    if (!allowNestedFunctions && (current.type === 'FunctionExpression' || current.type === 'ArrowFunctionExpression')) {
      return
    }

    if (current.type === 'CallExpression') {
      const calleeName = getOxcCallExpressionCalleeName(current.callee)
      if (calleeName === 'setData') {
        inspection.hasSetDataCall = true
      }
      if (current.callee?.type === 'MemberExpression' && current.callee.object?.type === 'Identifier' && current.callee.object.name === 'wx') {
        const propertyName = getOxcMemberExpressionPropertyName(current.callee)
        if (propertyName && propertyName.endsWith('Sync')) {
          inspection.syncApis.add(`wx.${propertyName}`)
        }
      }
    }
    else if (current.type === 'ChainExpression') {
      visit(current.expression, allowNestedFunctions)
      return
    }

    for (const value of Object.values(current)) {
      if (!value) {
        continue
      }
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child === 'object' && typeof child.type === 'string') {
            visit(child)
          }
        }
      }
      else if (typeof value === 'object' && typeof (value as any).type === 'string') {
        visit(value)
      }
    }
  }

  if (root) {
    visit(root, true)
  }

  return inspection
}

export function collectOnPageScrollWarningsWithOxc(
  code: string,
  filename: string,
): string[] {
  const ast = parseJsLikeWithEngine(code, {
    engine: 'oxc',
    filename: 'inline.ts',
  }) as any
  const onPageScrollHookNames = new Set<string>(['onPageScroll'])
  const namespaceImports = new Set<string>()

  for (const statement of ast.body ?? []) {
    if (statement?.type !== 'ImportDeclaration' || statement.source?.value !== 'wevu') {
      continue
    }
    for (const specifier of statement.specifiers ?? []) {
      if (
        specifier.type === 'ImportSpecifier'
        && specifier.imported?.type === 'Identifier'
        && specifier.imported.name === 'onPageScroll'
        && specifier.local?.type === 'Identifier'
      ) {
        onPageScrollHookNames.add(specifier.local.name)
      }
      else if (specifier.type === 'ImportNamespaceSpecifier' && specifier.local?.type === 'Identifier') {
        namespaceImports.add(specifier.local.name)
      }
    }
  }

  const lineStarts = createLineStartOffsets(code)
  const warnings: string[] = []
  const warningSet = new Set<string>()
  const addWarning = (warning: string) => {
    if (warningSet.has(warning)) {
      return
    }
    warningSet.add(warning)
    warnings.push(warning)
  }

  const reportInspection = (node: any, sourceLabel: string, startOffset = node.start) => {
    const inspection = collectPageScrollInspectionWithOxc(node)
    const loc = getLocationFromOffset(startOffset, lineStarts)
    const prefix = createWarningPrefix(filename, loc?.line, loc?.column)
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

  function visit(node: any) {
    if (!node) {
      return
    }
    if (node.type === 'Property' && !node.computed && getOxcStaticPropertyName(node.key) === 'onPageScroll' && isOxcFunctionLike(node.value)) {
      const startOffset = node.method ? node.key?.end : node.value.start
      reportInspection(node.value, 'onPageScroll', startOffset)
    }
    else if (
      node.type === 'CallExpression'
      && isOxcOnPageScrollCallee(node.callee, onPageScrollHookNames, namespaceImports)
    ) {
      const arg0 = node.arguments?.[0]
      if (arg0 && arg0.type !== 'SpreadElement' && isOxcFunctionLike(arg0)) {
        reportInspection(arg0, 'onPageScroll(...)')
      }
    }
    else if (node.type === 'ChainExpression' && node.expression?.type === 'CallExpression') {
      const arg0 = node.expression.arguments?.[0]
      if (
        isOxcOnPageScrollCallee(node.expression.callee, onPageScrollHookNames, namespaceImports)
        && arg0
        && arg0.type !== 'SpreadElement'
        && isOxcFunctionLike(arg0)
      ) {
        reportInspection(arg0, 'onPageScroll(...)')
      }
    }

    for (const value of Object.values(node)) {
      if (!value) {
        continue
      }
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child === 'object' && typeof child.type === 'string') {
            visit(child)
          }
        }
      }
      else if (typeof value === 'object' && typeof (value as any).type === 'string') {
        visit(value)
      }
    }
  }

  visit(ast)
  return warnings
}
