import { performance } from 'node:perf_hooks'

const AUTO_ROUTES_DYNAMIC_IMPORT_RE = /import\(\s*['"](?:weapp-vite\/auto-routes|virtual:weapp-vite-auto-routes)['"]\s*\)/g
const AUTO_ROUTES_ID = 'weapp-vite/auto-routes'
const AUTO_ROUTES_VIRTUAL_ID = 'virtual:weapp-vite-auto-routes'
const AUTO_ROUTES_NAMED_IMPORT_ALIAS_RE = /\s+as\s+/g
const AUTO_ROUTES_DEFAULT_AND_NAMED_IMPORT_RE = /^([A-Z_$][\w$]*)\s*,\s*(\{[^}]+\})$/i

export function mayNeedInlineAutoRoutes(source: string) {
  return source.includes(AUTO_ROUTES_ID) || source.includes(AUTO_ROUTES_VIRTUAL_ID)
}

function toObjectDestructureClause(namedImportClause: string) {
  return namedImportClause.replace(AUTO_ROUTES_NAMED_IMPORT_ALIAS_RE, ': ')
}

function resolveInlineAutoRoutesImport(line: string, inlineRoutes: Record<string, unknown>, replacementIndex: number) {
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

export function createTransformStageMeasurer(vueTransformTiming: ((payload: {
  id: string
  isPage: boolean
  totalMs: number
  stages: Record<string, number>
}) => void) | undefined) {
  const stageTimings: Record<string, number> = {}
  const totalStart = vueTransformTiming ? performance.now() : 0

  const measureStage = async <T>(label: string, task: () => Promise<T>) => {
    if (!vueTransformTiming) {
      return await task()
    }
    const start = performance.now()
    const result = await task()
    stageTimings[label] = Number((performance.now() - start).toFixed(2))
    return result
  }

  const reportTiming = (id: string, isPage: boolean) => {
    if (!vueTransformTiming) {
      return
    }
    vueTransformTiming({
      id,
      isPage,
      totalMs: Number((performance.now() - totalStart).toFixed(2)),
      stages: stageTimings,
    })
  }

  return {
    measureStage,
    reportTiming,
  }
}

export async function inlineTransformAutoRoutes(options: {
  source: string
  autoRoutesService?: {
    ensureFresh?: () => Promise<void>
    getReference?: () => {
      pages?: unknown[]
      entries?: unknown[]
      subPackages?: unknown[]
    } | undefined
  }
}) {
  const { source, autoRoutesService } = options
  if (!mayNeedInlineAutoRoutes(source)) {
    return source
  }

  AUTO_ROUTES_DYNAMIC_IMPORT_RE.lastIndex = 0

  await autoRoutesService?.ensureFresh?.()

  const routesRef = autoRoutesService?.getReference?.()
  const inlineRoutes = {
    pages: routesRef?.pages ?? [],
    entries: routesRef?.entries ?? [],
    subPackages: routesRef?.subPackages ?? [],
  }

  let importReplacementIndex = 0
  return source
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
    .replace(AUTO_ROUTES_DYNAMIC_IMPORT_RE, `Promise.resolve(${JSON.stringify(inlineRoutes)})`)
}
