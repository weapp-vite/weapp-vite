
export interface WxsTransformResult {
  code: string
  dependencies: string[]
}

export interface WxsTransformOptions {
  resolvePath: (request: string, importer: string) => string | undefined
  toImportPath?: (resolved: string, importer: string) => string
}

const REQUIRE_RE = /require\\(\\s*['"]([^'"]+)['"]\\s*\\)/g

function normalizePath(p: string) {
  return p.split('\\\\').join('/')
}

function ensureWxsExtension(pathname: string) {
  if (pathname.endsWith('.wxs') || pathname.endsWith('.wxs.ts') || pathname.endsWith('.wxs.js')) {
    return pathname
  }
  return `${pathname}.wxs`
}

export function transformWxsToEsm(code: string, id: string, options: WxsTransformOptions): WxsTransformResult {
  const dependencies: string[] = []
  const importLines: string[] = []
  const mapEntries: string[] = []

  let match: RegExpExecArray | null
  const seen = new Set<string>()
  while ((match = REQUIRE_RE.exec(code))) {
    const request = match[1]
    if (!request || seen.has(request)) {
      continue
    }
    seen.add(request)
    const resolved = ensureWxsExtension(options.resolvePath(request, id) ?? request)
    const importPath = normalizePath(options.toImportPath?.(resolved, id) ?? resolved)
    const importName = `__wxs_dep_${dependencies.length}`
    importLines.push(`import ${importName} from '${importPath}'`)
    mapEntries.push(`[${JSON.stringify(request)}, ${importName}]`)
    dependencies.push(resolved)
  }

  const requireMap = `const __wxs_require_map = new Map([${mapEntries.join(', ')}])`
  const requireFn = `function require(id) { return __wxs_require_map.get(id) }`
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

  return { code: body, dependencies }
}
