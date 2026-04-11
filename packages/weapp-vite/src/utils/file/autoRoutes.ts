import { createRequire } from 'node:module'
import { fs } from '@weapp-core/shared'
import path from 'pathe'

const nodeRequire = createRequire(import.meta.url)
const AUTO_ROUTES_ID = 'weapp-vite/auto-routes'
const AUTO_ROUTES_VIRTUAL_ID = 'virtual:weapp-vite-auto-routes'
const AUTO_ROUTES_SPECIFIER_RE = /(['"])(?:weapp-vite\/auto-routes|virtual:weapp-vite-auto-routes)\1/g
const AUTO_ROUTES_DYNAMIC_IMPORT_RE = /import\(\s*['"](?:weapp-vite\/auto-routes|virtual:weapp-vite-auto-routes)['"]\s*\)/g
const AUTO_ROUTES_NAMED_IMPORT_ALIAS_RE = /\bas\b/g
const AUTO_ROUTES_DEFAULT_AND_NAMED_IMPORT_RE = /^([A-Z_$][\w$]*)\s*,\s*(\{[^}]+\})$/i

export interface AutoRoutesInlineSnapshot {
  pages: string[]
  entries: string[]
  subPackages: Array<{ root: string, pages: string[] }>
}

function toObjectDestructureClause(namedImportClause: string) {
  return namedImportClause.replace(AUTO_ROUTES_NAMED_IMPORT_ALIAS_RE, ':')
}

function resolveInlineAutoRoutesImport(line: string, inlineRoutes: AutoRoutesInlineSnapshot, replacementIndex: number) {
  const trimmedLine = line.trim()
  if (
    !trimmedLine.startsWith('import ')
    || !trimmedLine.includes(' from ')
    || (!trimmedLine.includes(`'${AUTO_ROUTES_ID}'`) && !trimmedLine.includes(`"${AUTO_ROUTES_ID}"`) && !trimmedLine.includes(`'${AUTO_ROUTES_VIRTUAL_ID}'`) && !trimmedLine.includes(`"${AUTO_ROUTES_VIRTUAL_ID}"`))
  ) {
    return undefined
  }

  const clause = trimmedLine.slice('import '.length, trimmedLine.lastIndexOf(' from ')).trim()
  const inlineLiteral = JSON.stringify(inlineRoutes)

  if (clause.startsWith('{')) {
    return `const ${toObjectDestructureClause(clause)} = ${inlineLiteral};`
  }

  if (clause.startsWith('* as ')) {
    return `const ${clause.slice(5).trim()} = ${inlineLiteral};`
  }

  const defaultAndNamedMatch = clause.match(AUTO_ROUTES_DEFAULT_AND_NAMED_IMPORT_RE)
  if (defaultAndNamedMatch) {
    const [, defaultName, namedClause] = defaultAndNamedMatch
    const localRef = `__weappViteAutoRoutesInline${replacementIndex}`
    return `const ${localRef} = ${inlineLiteral};\nconst ${defaultName} = ${localRef};\nconst ${toObjectDestructureClause(namedClause)} = ${localRef};`
  }

  return `const ${clause} = ${inlineLiteral};`
}

export function getAutoRoutesMacroImportCandidates(baseDir: string = import.meta.dirname) {
  return [
    path.resolve(baseDir, './auto-routes.mjs'),
    path.resolve(baseDir, '../auto-routes.mjs'),
    path.resolve(baseDir, '../../dist/auto-routes.mjs'),
    path.resolve(baseDir, '../../src/auto-routes.ts'),
    path.resolve(baseDir, '../../auto-routes.ts'),
  ]
}

function resolveAutoRoutesMacroImportPath() {
  const fallbackCandidates = getAutoRoutesMacroImportCandidates()
  try {
    const resolved = nodeRequire.resolve('weapp-vite/auto-routes')
    if (fs.existsSync(resolved)) {
      return resolved
    }
  }
  catch {
    // ignore
  }

  for (const candidate of fallbackCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  throw new Error('无法解析 auto-routes 模块路径。')
}

export async function resolveAutoRoutesInlineSnapshot(): Promise<AutoRoutesInlineSnapshot> {
  try {
    const { getCompilerContext } = await import('../../context/getInstance')
    const compilerContext = getCompilerContext()
    const service = compilerContext.autoRoutesService
    const reference = service?.getReference?.()

    // 解析 app.vue 的 JSON 宏期间，auto-routes 可能正处于首次扫描阶段。
    // 这里如果再次 ensureFresh 会递归回到 loadAppEntry -> extractConfigFromVue，
    // 从而让 build 卡死。此时直接复用当前快照或回退为空结果即可。
    if (!compilerContext.runtimeState.autoRoutes.loadingAppConfig) {
      await service?.ensureFresh?.()
    }

    const nextReference = service?.getReference?.() ?? reference
    return {
      pages: nextReference?.pages ?? [],
      entries: nextReference?.entries ?? [],
      subPackages: nextReference?.subPackages ?? [],
    }
  }
  catch {
    return {
      pages: [],
      entries: [],
      subPackages: [],
    }
  }
}

export function inlineAutoRoutesImports(
  source: string,
  inlineRoutes: AutoRoutesInlineSnapshot,
) {
  let importReplacementIndex = 0
  const sourceWithStaticImportsInlined = source
    .split('\n')
    .map((line) => {
      const replaced = resolveInlineAutoRoutesImport(line, inlineRoutes, importReplacementIndex)
      if (replaced) {
        importReplacementIndex += 1
        return replaced
      }
      return line
    })
    .join('\n')

  return sourceWithStaticImportsInlined
    .replace(AUTO_ROUTES_DYNAMIC_IMPORT_RE, `Promise.resolve(${JSON.stringify(inlineRoutes)})`)
    .replace(AUTO_ROUTES_SPECIFIER_RE, JSON.stringify(resolveAutoRoutesMacroImportPath()))
}
