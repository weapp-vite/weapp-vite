import { createRequire } from 'node:module'
import process from 'node:process'
import { fs } from '@weapp-core/shared'
import { recursive as mergeRecursive } from 'merge'
import path from 'pathe'
import { parse } from 'vue/compiler-sfc'
import { configExtensions, jsExtensions, supportedCssLangs, templateExtensions, vueExtensions } from '../constants'

const pathExistsInFlight = new Map<string, Promise<boolean>>()
const vueConfigCache = new Map<string, {
  config?: Record<string, any>
  fileMtimeMs?: number
  dependencies: string[]
  dependencyMtimeMs: Map<string, number>
}>()
const configMtimeInFlight = new Map<string, Promise<number | undefined>>()
const NODE_MODULES_RE = /[\\/]node_modules[\\/]/
const JS_OR_TS_RE = /\.[jt]s$/
const nodeRequire = createRequire(import.meta.url)
const AUTO_ROUTES_ID = 'weapp-vite/auto-routes'
const AUTO_ROUTES_VIRTUAL_ID = 'virtual:weapp-vite-auto-routes'
const AUTO_ROUTES_SPECIFIER_RE = /(['"])(?:weapp-vite\/auto-routes|virtual:weapp-vite-auto-routes)\1/g
const AUTO_ROUTES_DYNAMIC_IMPORT_RE = /import\(\s*['"](?:weapp-vite\/auto-routes|virtual:weapp-vite-auto-routes)['"]\s*\)/g
const AUTO_ROUTES_NAMED_IMPORT_ALIAS_RE = /\bas\b/g
const AUTO_ROUTES_DEFAULT_AND_NAMED_IMPORT_RE = /^([A-Z_$][\w$]*)\s*,\s*(\{[^}]+\})$/i
const JSON_MACRO_HINT_RE = /\bdefine(?:App|Page|Component|Sitemap|Theme)Json\s*\(/

interface AutoRoutesInlineSnapshot {
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

function resolveAutoRoutesMacroImportPath() {
  const fallbackCandidates = [
    path.resolve(import.meta.dirname, 'auto-routes.mjs'),
    path.resolve(import.meta.dirname, '../dist/auto-routes.mjs'),
    path.resolve(import.meta.dirname, '../src/auto-routes.ts'),
    path.resolve(import.meta.dirname, '../auto-routes.ts'),
  ]
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
    const { getCompilerContext } = await import('../context/getInstance')
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
      pages: [] as string[],
      entries: [] as string[],
      subPackages: [] as Array<{ root: string, pages: string[] }>,
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

function pathExistsCached(filePath: string) {
  const pending = pathExistsInFlight.get(filePath)
  if (pending) {
    return pending
  }
  const next = fs.pathExists(filePath).finally(() => {
    pathExistsInFlight.delete(filePath)
  })
  pathExistsInFlight.set(filePath, next)
  return next
}

function getMtimeCached(filePath: string) {
  const pending = configMtimeInFlight.get(filePath)
  if (pending) {
    return pending
  }
  const next = fs.stat(filePath)
    .then(stat => stat.mtimeMs)
    .catch(() => undefined)
    .finally(() => {
      configMtimeInFlight.delete(filePath)
    })
  configMtimeInFlight.set(filePath, next)
  return next
}

async function isVueConfigCacheValid(vueFilePath: string, cache: {
  fileMtimeMs?: number
  dependencies: string[]
  dependencyMtimeMs: Map<string, number>
}) {
  const nextMtime = await getMtimeCached(vueFilePath)
  if (nextMtime === undefined || cache.fileMtimeMs === undefined) {
    return false
  }
  if (nextMtime !== cache.fileMtimeMs) {
    return false
  }
  if (cache.dependencies.length === 0) {
    return true
  }
  for (const dep of cache.dependencies) {
    const nextDepMtime = await getMtimeCached(dep)
    const cachedDepMtime = cache.dependencyMtimeMs.get(dep)
    if (nextDepMtime === undefined || cachedDepMtime === undefined || nextDepMtime !== cachedDepMtime) {
      return false
    }
  }
  return true
}

export function isJsOrTs(name?: string) {
  if (typeof name === 'string') {
    return JS_OR_TS_RE.test(name)
  }
  return false
}

export function isTemplateRequest(request: string) {
  return request.endsWith('.wxml') || request.endsWith('.html')
}

export function normalizeFileExtension(extension: string) {
  return extension ? (extension.startsWith('.') ? extension : `.${extension}`) : ''
}

export function changeFileExtension(filePath: string, extension: string) {
  if (typeof filePath !== 'string') {
    throw new TypeError(`Expected \`filePath\` to be a string, got \`${typeof filePath}\`.`)
  }

  if (typeof extension !== 'string') {
    throw new TypeError(`Expected \`extension\` to be a string, got \`${typeof extension}\`.`)
  }

  if (filePath === '') {
    return ''
  }

  extension = normalizeFileExtension(extension)

  const basename = path.basename(filePath, path.extname(filePath))
  return path.join(path.dirname(filePath), basename + extension)
}

export async function findVueEntry(filepath: string) {
  for (const ext of vueExtensions) {
    const p = changeFileExtension(filepath, ext)
    if (await pathExistsCached(p)) {
      return p
    }
  }
}

export async function findJsEntry(filepath: string): Promise<{
  predictions: string[]
  path?: string
}> {
  const predictions = jsExtensions.map((ext) => {
    return changeFileExtension(filepath, ext)
  })
  for (const p of predictions) {
    if (await pathExistsCached(p)) {
      return {
        path: p,
        predictions,
      }
    }
  }
  return {
    predictions,
  }
}

export async function findJsonEntry(filepath: string): Promise<{
  predictions: string[]
  path?: string
}> {
  const predictions = configExtensions.map((ext) => {
    return changeFileExtension(filepath, ext)
  })
  for (const p of predictions) {
    if (await pathExistsCached(p)) {
      return {
        predictions,
        path: p,
      }
    }
  }
  return {
    predictions,
  }
}

export async function findCssEntry(filepath: string): Promise<{
  predictions: string[]
  path?: string
}> {
  const predictions = supportedCssLangs.map((ext) => {
    return changeFileExtension(filepath, ext)
  })
  for (const p of predictions) {
    if (await pathExistsCached(p)) {
      return {
        predictions,
        path: p,
      }
    }
  }
  return {
    predictions,
  }
}

export async function findTemplateEntry(filepath: string): Promise<{
  predictions: string[]
  path?: string
}> {
  const predictions = templateExtensions.map((ext) => {
    return changeFileExtension(filepath, ext)
  })
  for (const p of predictions) {
    if (await pathExistsCached(p)) {
      return {
        predictions,
        path: p,
      }
    }
  }
  return {
    predictions,
  }
}

export function isTemplate(filepath: string) {
  return templateExtensions.some(ext => filepath.endsWith(`.${ext}`))
}
export function touchSync(filename: string) {
  const time = new Date()

  try {
    fs.utimesSync(filename, time, time)
  }
  catch {
    fs.closeSync(fs.openSync(filename, 'w'))
  }
}
export async function touch(filename: string) {
  const time = new Date()

  try {
    await fs.utimes(filename, time, time)
  }
  catch {
    await fs.close(await fs.open(filename, 'w'))
  }
}

/**
 * 从 .vue 文件中提取 <json> 块的内容
 * @param vueFilePath .vue 文件的路径
 * @returns 提取的配置对象，如果不存在或解析失败则返回 undefined
 */
export async function extractConfigFromVue(vueFilePath: string): Promise<Record<string, any> | undefined> {
  try {
    const cached = vueConfigCache.get(vueFilePath)
    if (cached && await isVueConfigCacheValid(vueFilePath, cached)) {
      return cached.config
    }

    const content = await fs.readFile(vueFilePath, 'utf-8')
    const { descriptor, errors } = parse(content, { filename: vueFilePath })

    if (errors.length > 0) {
      return undefined
    }

    // 合并所有配置块（如果有多个）
    const mergedConfig: Record<string, any> = {}
    const macroDependencies: string[] = []
    const { parse: parseJson } = await import('comment-json')

    // 1) <json> 自定义块（历史兼容）
    const jsonBlocks = descriptor.customBlocks.filter(block => block.type === 'json')
    for (const block of jsonBlocks) {
      try {
        // 默认（不写 lang）即为 json，且支持注释（comment-json）
        const lang = (block.lang || 'json').toLowerCase()
        if (lang === 'json' || lang === 'jsonc' || lang === 'json5' || lang === 'txt') {
          const config = parseJson(block.content, undefined, true)
          if (config && typeof config === 'object' && !Array.isArray(config)) {
            Object.assign(mergedConfig, config)
          }
          continue
        }
      }
      catch {
        // 忽略解析错误
      }
    }

    // 2) <script setup> JSON 宏：defineAppJson / definePageJson / defineComponentJson / defineSitemapJson / defineThemeJson
    // 注意：这些宏是 build-time 的，需要在 Node.js 侧执行一次来得到配置对象。
    const setupContent = descriptor.scriptSetup?.content
    const hasMacroHint = typeof setupContent === 'string'
      && JSON_MACRO_HINT_RE.test(setupContent)

    if (hasMacroHint) {
      const { extractJsonMacroFromScriptSetup } = await import('wevu/compiler')
      try {
        const autoRoutesInline = await resolveAutoRoutesInlineSnapshot()
        const macroEvalPreamble = descriptor.script?.content
          ? inlineAutoRoutesImports(descriptor.script.content, autoRoutesInline)
          : undefined
        const macroEvalContent = inlineAutoRoutesImports(setupContent!, autoRoutesInline)
        const extracted = await extractJsonMacroFromScriptSetup(
          macroEvalContent,
          vueFilePath,
          descriptor.scriptSetup?.lang,
          {
            preambleContent: macroEvalPreamble,
          },
        )
        if (extracted.dependencies?.length) {
          macroDependencies.push(...extracted.dependencies)
        }
        if (extracted.config && typeof extracted.config === 'object' && !Array.isArray(extracted.config)) {
          mergeRecursive(mergedConfig, extracted.config)
        }
      }
      catch (error) {
        // 如果这个 .vue 里确实在用宏，但解析/执行失败，优先暴露错误（否则会误报“找不到 app.json/app.vue”）
        if (jsonBlocks.length === 0) {
          throw error
        }
      }
    }

    const normalizedDependencies = [...new Set(
      macroDependencies
        .filter(dep => dep && !NODE_MODULES_RE.test(dep))
        .map(dep => path.normalize(dep)),
    )]
    const dependencyMtimeMs = new Map<string, number>()
    await Promise.all(
      normalizedDependencies.map(async (dep) => {
        const mtime = await getMtimeCached(dep)
        if (mtime !== undefined) {
          dependencyMtimeMs.set(dep, mtime)
        }
      }),
    )
    const fileMtimeMs = await getMtimeCached(vueFilePath)
    const hasConfig = Object.keys(mergedConfig).length > 0
    vueConfigCache.set(vueFilePath, {
      config: hasConfig ? mergedConfig : undefined,
      fileMtimeMs,
      dependencies: normalizedDependencies,
      dependencyMtimeMs,
    })

    return hasConfig ? mergedConfig : undefined
  }
  catch (error) {
    if (process.env.__WEAPP_VITE_DEBUG_VUE_CONFIG__) {
      // eslint-disable-next-line no-console
      console.error('[extractConfigFromVue] failed:', vueFilePath, error)
    }
    return undefined
  }
}
