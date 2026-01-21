export interface WxsTransformResult {
  code: string
  dependencies: string[]
  warnings?: string[]
}

export interface WxsTransformOptions {
  resolvePath: (request: string, importer: string) => string | undefined
  toImportPath?: (resolved: string, importer: string) => string
}

const REQUIRE_RE = /require\(\s*['"]([^'"]+)['"]\s*\)/g

function normalizePath(p: string) {
  return p.split('\\\\').join('/')
}

function isPlainWxsScript(pathname: string) {
  const lower = pathname.toLowerCase()
  if (lower.endsWith('.wxs') || lower.endsWith('.wxs.ts') || lower.endsWith('.wxs.js')) {
    return false
  }
  return lower.endsWith('.ts') || lower.endsWith('.js')
}

function appendWxsQuery(pathname: string) {
  if (pathname.includes('?wxs') || pathname.includes('&wxs')) {
    return pathname
  }
  return `${pathname}${pathname.includes('?') ? '&' : '?'}wxs`
}

function isSupportedRequirePath(request: string) {
  return request.startsWith('.') || request.startsWith('/')
}

export function transformWxsToEsm(code: string, id: string, options: WxsTransformOptions): WxsTransformResult {
  const dependencies: string[] = []
  const importLines: string[] = []
  const mapEntries: string[] = []
  const warnings: string[] = []

  const seen = new Set<string>()
  while (true) {
    const match = REQUIRE_RE.exec(code)
    if (!match) {
      break
    }
    const request = match[1]
    if (!request || seen.has(request)) {
      continue
    }
    seen.add(request)
    if (!isSupportedRequirePath(request)) {
      warnings.push(`[@weapp-vite/web] WXS require 仅支持相对或绝对路径: ${request} (from ${id})`)
      continue
    }
    const resolved = options.resolvePath(request, id)
    if (!resolved) {
      warnings.push(`[@weapp-vite/web] 无法解析 WXS require: ${request} (from ${id})`)
      continue
    }
    let importPath = normalizePath(options.toImportPath?.(resolved, id) ?? resolved)
    if (isPlainWxsScript(resolved)) {
      importPath = appendWxsQuery(importPath)
    }
    const importName = `__wxs_dep_${dependencies.length}`
    importLines.push(`import ${importName} from '${importPath}'`)
    mapEntries.push(`[${JSON.stringify(request)}, ${importName}]`)
    dependencies.push(resolved)
  }

  const requireMap = `const __wxs_require_map = new Map([${mapEntries.join(', ')}])`
  const requireFn = [
    `const __wxs_require_warned = new Set()`,
    `function require(id) {`,
    `  if (__wxs_require_map.has(id)) {`,
    `    return __wxs_require_map.get(id)`,
    `  }`,
    `  if (!__wxs_require_warned.has(id)) {`,
    `    __wxs_require_warned.add(id)`,
    `    if (typeof console !== 'undefined' && typeof console.warn === 'function') {`,
    `      console.warn(\`[@weapp-vite/web] WXS require 未解析: \${id}\`)`,
    `    }`,
    `  }`,
    `  return undefined`,
    `}`,
  ].join('\\n')
  const moduleInit = `const module = { exports: {} }\\nconst exports = module.exports`
  const helpers = `const getRegExp = (pattern, flags) => new RegExp(pattern, flags)\\nconst getDate = (value) => (value == null ? new Date() : new Date(value))`

  const body = [
    ...importLines,
    requireMap,
    requireFn,
    moduleInit,
    helpers,
    code,
    `export default module.exports`,
  ].join('\\n')

  return {
    code: body,
    dependencies,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}
