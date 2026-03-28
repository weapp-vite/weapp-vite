import type * as t from '@babel/types'
import type { AstEngineName } from '../types'
import { parseJsLike, traverse } from '../babel'
import { parseJsLikeWithEngine } from '../engine'

interface PageScrollInspection {
  empty: boolean
  hasSetDataCall: boolean
  syncApis: Set<string>
}

interface OxcLoc {
  line: number
  column: number
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

export function createWarningPrefix(filename: string, line?: number, column?: number): string {
  const pos = typeof line === 'number' && typeof column === 'number'
    ? `${line}:${column}`
    : '?:?'
  return `[weapp-vite][onPageScroll] ${filename}:${pos}`
}

function getOxcStaticPropertyName(node: any): string | undefined {
  if (!node) {
    return undefined
  }
  if (node.type === 'Identifier') {
    return node.name
  }
  if (
    (node.type === 'StringLiteral' || node.type === 'Literal')
    && typeof node.value === 'string'
  ) {
    return node.value
  }
  return undefined
}

function getOxcMemberExpressionPropertyName(node: any): string | undefined {
  if (!node || node.type !== 'MemberExpression') {
    return undefined
  }
  if (node.computed) {
    return getOxcStaticPropertyName(node.property)
  }
  return node.property?.type === 'Identifier' ? node.property.name : undefined
}

function isOxcFunctionLike(node: any) {
  return node?.type === 'FunctionExpression'
    || node?.type === 'ArrowFunctionExpression'
}

function isOxcOnPageScrollCallee(
  callee: any,
  hookNames: Set<string>,
  namespaceImports: Set<string>,
): boolean {
  if (!callee) {
    return false
  }
  if (callee.type === 'Identifier') {
    return hookNames.has(callee.name)
  }
  if (callee.type === 'MemberExpression') {
    const propName = getOxcMemberExpressionPropertyName(callee)
    return callee.object?.type === 'Identifier'
      && namespaceImports.has(callee.object.name)
      && propName === 'onPageScroll'
  }
  return false
}

function getOxcCallExpressionCalleeName(callee: any): string | undefined {
  if (!callee) {
    return undefined
  }
  if (callee.type === 'Identifier') {
    return callee.name
  }
  if (callee.type === 'MemberExpression') {
    return getOxcMemberExpressionPropertyName(callee)
  }
  return undefined
}

export function createLineStartOffsets(code: string) {
  const offsets = [0]
  for (let index = 0; index < code.length; index += 1) {
    if (code.charCodeAt(index) === 10) {
      offsets.push(index + 1)
    }
  }
  return offsets
}

export function getLocationFromOffset(offset: number | undefined, lineStarts: number[]): OxcLoc | undefined {
  if (typeof offset !== 'number' || offset < 0) {
    return undefined
  }
  let low = 0
  let high = lineStarts.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    if (lineStarts[mid] <= offset) {
      low = mid + 1
    }
    else {
      high = mid - 1
    }
  }
  const lineIndex = Math.max(0, low - 1)
  return {
    line: lineIndex + 1,
    column: offset - lineStarts[lineIndex] + 1,
  }
}

function collectPageScrollInspectionWithOxc(node: any): PageScrollInspection {
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

function collectWithOxc(
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

/**
 * 静态检测 onPageScroll 中的常见性能风险并返回告警文案。
 */
export function collectOnPageScrollPerformanceWarnings(
  code: string,
  filename: string,
  options?: {
    engine?: AstEngineName
  },
): string[] {
  if (!code.includes('onPageScroll')) {
    return []
  }

  if (options?.engine === 'oxc') {
    try {
      return collectWithOxc(code, filename)
    }
    catch {
      return []
    }
  }

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
