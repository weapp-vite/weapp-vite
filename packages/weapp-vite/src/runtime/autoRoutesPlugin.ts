import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../context'
import type { ChangeEvent } from '../types'
import type { AutoRoutes, AutoRoutesSubPackage } from '../types/routes'
import { removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import { configExtensions, jsExtensions, templateExtensions, vueExtensions } from '../constants'
import { logger } from '../context/shared'

interface CandidateEntry {
  base: string
  files: Set<string>
  hasScript: boolean
  hasTemplate: boolean
  jsonPath?: string
}

interface ScanResult {
  snapshot: AutoRoutes
  serialized: string
  moduleCode: string
  typedDefinition: string
  watchFiles: Set<string>
  watchDirs: Set<string>
}

interface ResolvedRoute {
  entry: string
  pagePath: string
  root?: string
}

const SCRIPT_EXTENSIONS = new Set(jsExtensions.map(ext => `.${ext}`))
const TEMPLATE_EXTENSIONS = new Set(templateExtensions.map(ext => `.${ext}`))
const VUE_EXTENSIONS = new Set(vueExtensions.map(ext => `.${ext}`))
const CONFIG_SUFFIXES = configExtensions.map(ext => `.${ext}`)
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'miniprogram_npm', '.git', '.idea', '.husky', '.turbo', '.cache', 'dist'])

function toPosix(filePath: string) {
  return filePath.replace(/\\/g, '/')
}

function isConfigFile(filePath: string) {
  return CONFIG_SUFFIXES.some(ext => filePath.endsWith(ext))
}

function isScriptFile(filePath: string) {
  if (filePath.endsWith('.d.ts')) {
    return false
  }
  if (/\.wxs\.[jt]s$/i.test(filePath) || /\.wxml\.[jt]s$/i.test(filePath)) {
    return false
  }
  const ext = path.extname(filePath)
  return SCRIPT_EXTENSIONS.has(ext)
}

function isVueFile(filePath: string) {
  const ext = path.extname(filePath)
  return VUE_EXTENSIONS.has(ext)
}

function isTemplateFile(filePath: string) {
  const ext = path.extname(filePath)
  return TEMPLATE_EXTENSIONS.has(ext)
}

function shouldSkipDirectory(dirent: fs.Dirent) {
  if (!dirent.isDirectory()) {
    return false
  }

  if (dirent.isSymbolicLink()) {
    return true
  }

  return SKIPPED_DIRECTORIES.has(dirent.name)
}

function ensureCandidate(map: Map<string, CandidateEntry>, base: string) {
  let candidate = map.get(base)
  if (!candidate) {
    candidate = {
      base,
      files: new Set<string>(),
      hasScript: false,
      hasTemplate: false,
    }
    map.set(base, candidate)
  }
  return candidate
}

function resolveRoute(normalizedBase: string): ResolvedRoute | undefined {
  if (normalizedBase.startsWith('pages/')) {
    return {
      entry: normalizedBase,
      pagePath: normalizedBase,
    }
  }

  const idx = normalizedBase.indexOf('/pages/')
  if (idx === -1) {
    return undefined
  }

  const root = normalizedBase.slice(0, idx)
  const pagePath = normalizedBase.slice(idx + 1)
  if (!root || !pagePath.startsWith('pages/')) {
    return undefined
  }

  return {
    root,
    pagePath,
    entry: `${root}/${pagePath}`,
  }
}

function resolvePagesDirectory(normalizedBase: string, absoluteSrcRoot: string) {
  if (normalizedBase.startsWith('pages/')) {
    return path.join(absoluteSrcRoot, 'pages')
  }

  const idx = normalizedBase.indexOf('/pages/')
  if (idx === -1) {
    return undefined
  }

  const root = normalizedBase.slice(0, idx)
  if (!root) {
    return undefined
  }
  return path.join(absoluteSrcRoot, root, 'pages')
}

function ensureSubPackage(map: Map<string, Set<string>>, root: string) {
  let set = map.get(root)
  if (!set) {
    set = new Set<string>()
    map.set(root, set)
  }
  return set
}

async function collectCandidates(
  absoluteSrcRoot: string,
) {
  const queue: string[] = [absoluteSrcRoot]
  const candidates = new Map<string, CandidateEntry>()

  while (queue.length > 0) {
    const current = queue.pop()!
    let dirents: fs.Dirent[]
    try {
      dirents = await fs.readdir(current, { withFileTypes: true })
    }
    catch {
      continue
    }

    for (const dirent of dirents) {
      const entryPath = path.join(current, dirent.name)

      if (shouldSkipDirectory(dirent)) {
        continue
      }

      if (dirent.isDirectory()) {
        queue.push(entryPath)
        continue
      }

      const normalizedRelative = toPosix(path.relative(absoluteSrcRoot, entryPath))
      if (!normalizedRelative || normalizedRelative.startsWith('..')) {
        continue
      }

      const isPagesCandidate = normalizedRelative.startsWith('pages/')
        || normalizedRelative.includes('/pages/')

      if (!isPagesCandidate) {
        continue
      }

      const candidateBase = removeExtensionDeep(entryPath)
      const candidate = ensureCandidate(candidates, candidateBase)
      candidate.files.add(entryPath)

      if (isConfigFile(entryPath)) {
        candidate.jsonPath = entryPath
        continue
      }

      if (isVueFile(entryPath) || isScriptFile(entryPath)) {
        candidate.hasScript = true
      }

      if (isTemplateFile(entryPath)) {
        candidate.hasTemplate = true
      }
    }
  }

  return candidates
}

function formatReadonlyTuple(values: string[], baseIndent = '') {
  if (values.length === 0) {
    return 'readonly []'
  }

  const indent = `${baseIndent}  `
  const lines = values.map(value => `${indent}${JSON.stringify(value)}`)
  return `readonly [\n${lines.join(',\n')}\n${baseIndent}]`
}

function formatReadonlySubPackages(subPackages: AutoRoutesSubPackage[]) {
  if (subPackages.length === 0) {
    return 'readonly []'
  }

  const lines: string[] = ['readonly [']

  subPackages.forEach((pkg, index) => {
    lines.push('  {')
    lines.push(`    readonly root: ${JSON.stringify(pkg.root)};`)
    const pages = formatReadonlyTuple(pkg.pages, '    ')
    lines.push(`    readonly pages: ${pages};`)
    lines.push(`  }${index < subPackages.length - 1 ? ',' : ''}`)
  })

  lines.push(']')
  return lines.join('\n')
}

function createTypedRouterDefinition(routes: AutoRoutes) {
  const pagesType = formatReadonlyTuple(routes.pages)
  const entriesType = formatReadonlyTuple(routes.entries)
  const subPackagesType = formatReadonlySubPackages(routes.subPackages)

  return [
    '// Auto-generated by weapp-vite. Do not edit.',
    'declare module \'weapp-vite/auto-routes\' {',
    `  export type AutoRoutesPages = ${pagesType};`,
    `  export type AutoRoutesEntries = ${entriesType};`,
    `  export type AutoRoutesSubPackages = ${subPackagesType};`,
    '  export type AutoRoutesSubPackage = AutoRoutesSubPackages[number];',
    '  export interface AutoRoutes {',
    '    readonly pages: AutoRoutesPages;',
    '    readonly entries: AutoRoutesEntries;',
    '    readonly subPackages: AutoRoutesSubPackages;',
    '  }',
    '  export const routes: AutoRoutes;',
    '  export const pages: AutoRoutesPages;',
    '  export const entries: AutoRoutesEntries;',
    '  export const subPackages: AutoRoutesSubPackages;',
    '  export default routes;',
    '}',
    '',
  ].join('\n')
}

async function scanRoutes(
  ctx: MutableCompilerContext,
): Promise<ScanResult> {
  const configService = ctx.configService
  const jsonService = ctx.jsonService

  if (!configService || !jsonService) {
    throw new Error('configService/jsonService must be initialized before scanning routes')
  }

  const absoluteSrcRoot = configService.absoluteSrcRoot
  const candidates = await collectCandidates(absoluteSrcRoot)
  const pagesSet = new Set<string>()
  const entriesSet = new Set<string>()
  const subPackages = new Map<string, Set<string>>()
  const watchFiles = new Set<string>()
  const watchDirs = new Set<string>()

  const candidateList = Array.from(candidates.values())
  const jsonEntries = await Promise.all(candidateList.map(async (candidate) => {
    if (!candidate.jsonPath) {
      return { candidate, json: undefined as Record<string, any> | undefined }
    }

    const json = await jsonService.read(candidate.jsonPath)
    return { candidate, json: json as Record<string, any> | undefined }
  }))

  const jsonMap = new Map<CandidateEntry, Record<string, any> | undefined>()
  for (const { candidate, json } of jsonEntries) {
    jsonMap.set(candidate, json)
  }

  const pagesRootSet = new Set<string>()

  for (const candidate of candidateList) {
    for (const file of candidate.files) {
      watchFiles.add(file)
    }

    const normalizedBase = toPosix(path.relative(absoluteSrcRoot, candidate.base))
    if (!normalizedBase || normalizedBase.startsWith('..')) {
      continue
    }

    const route = resolveRoute(normalizedBase)
    if (!route) {
      continue
    }

    const pagesDir = resolvePagesDirectory(normalizedBase, absoluteSrcRoot)
    if (pagesDir) {
      pagesRootSet.add(pagesDir)
    }

    watchDirs.add(path.dirname(candidate.base))

    const json = jsonMap.get(candidate)
    if (candidate.jsonPath && json === undefined) {
      continue
    }
    if (json && typeof json === 'object' && json.component === true) {
      continue
    }

    if (!candidate.hasScript && !candidate.hasTemplate && !candidate.jsonPath) {
      continue
    }

    entriesSet.add(route.entry)

    if (route.root) {
      const pagesForRoot = ensureSubPackage(subPackages, route.root)
      pagesForRoot.add(route.pagePath)
    }
    else {
      pagesSet.add(route.pagePath)
    }
  }

  for (const dir of pagesRootSet) {
    watchDirs.add(dir)
  }

  const pages = Array.from(pagesSet)
  const entries = Array.from(entriesSet)
  const subPackageList: AutoRoutesSubPackage[] = Array.from(subPackages.entries()).map(([root, value]) => {
    const pagesArray = Array.from(value)
    pagesArray.sort((a, b) => a.localeCompare(b))
    return {
      root,
      pages: pagesArray,
    }
  })

  pages.sort((a, b) => {
    if (a === 'pages/index/index') {
      return -1
    }
    if (b === 'pages/index/index') {
      return 1
    }
    return a.localeCompare(b)
  })

  entries.sort((a, b) => {
    if (a === 'pages/index/index') {
      return -1
    }
    if (b === 'pages/index/index') {
      return 1
    }
    return a.localeCompare(b)
  })

  subPackageList.sort((a, b) => a.root.localeCompare(b.root))

  const snapshot: AutoRoutes = {
    pages,
    entries,
    subPackages: subPackageList,
  }

  const serialized = JSON.stringify(snapshot, null, 2)
  const typedDefinition = createTypedRouterDefinition(snapshot)
  const moduleCode = [
    'const routes = ',
    serialized,
    ';',
    'const pages = routes.pages;',
    'const entries = routes.entries;',
    'const subPackages = routes.subPackages;',
    'export { routes, pages, entries, subPackages };',
    'export default routes;',
  ].join('\n')

  return {
    snapshot,
    serialized,
    moduleCode,
    typedDefinition,
    watchFiles,
    watchDirs,
  }
}

function updateWatchTargets(target: Set<string>, next: Set<string>) {
  target.clear()
  for (const item of next) {
    target.add(item)
  }
}

function cloneRoutes(routes: AutoRoutes): AutoRoutes {
  return {
    pages: [...routes.pages],
    entries: [...routes.entries],
    subPackages: routes.subPackages.map((pkg) => {
      return {
        root: pkg.root,
        pages: [...pkg.pages],
      }
    }),
  }
}

function assignArray(target: string[], source: string[]) {
  target.splice(0, target.length, ...source)
}

function updateRoutesReference(target: AutoRoutes, next: AutoRoutes) {
  assignArray(target.pages, next.pages)
  assignArray(target.entries, next.entries)

  const existing = new Map(target.subPackages.map(pkg => [pkg.root, pkg]))
  target.subPackages.length = 0
  for (const pkg of next.subPackages) {
    const preserved = existing.get(pkg.root)
    if (preserved) {
      assignArray(preserved.pages, pkg.pages)
      target.subPackages.push(preserved)
    }
    else {
      target.subPackages.push({ root: pkg.root, pages: [...pkg.pages] })
    }
  }
}

function matchesRouteFile(
  ctx: MutableCompilerContext,
  candidate: string,
) {
  const configService = ctx.configService
  if (!configService) {
    return false
  }

  const [pathWithoutQuery] = candidate.split('?')
  if (!pathWithoutQuery) {
    return false
  }

  const normalized = path.isAbsolute(pathWithoutQuery)
    ? pathWithoutQuery
    : path.resolve(configService.cwd, pathWithoutQuery)

  if (!normalized.startsWith(configService.absoluteSrcRoot)) {
    return false
  }

  const relative = toPosix(path.relative(configService.absoluteSrcRoot, normalized))
  if (!relative || relative.startsWith('..')) {
    return false
  }

  const isPagesPath = relative.startsWith('pages/')
    || relative.includes('/pages/')

  if (!isPagesPath) {
    return false
  }

  if (isConfigFile(normalized)) {
    return true
  }

  if (isVueFile(normalized) || isScriptFile(normalized) || isTemplateFile(normalized)) {
    return true
  }

  return false
}

export interface AutoRoutesService {
  ensureFresh: () => Promise<void>
  markDirty: () => void
  getSnapshot: () => AutoRoutes
  getReference: () => AutoRoutes
  getModuleCode: () => string
  getWatchFiles: () => Iterable<string>
  getWatchDirectories: () => Iterable<string>
  isRouteFile: (filePath: string) => boolean
  handleFileChange: (filePath: string, event?: ChangeEvent) => Promise<void>
  isInitialized: () => boolean
  isEnabled: () => boolean
}

export function createAutoRoutesService(ctx: MutableCompilerContext): AutoRoutesService {
  const state = ctx.runtimeState.autoRoutes
  let pendingScan: Promise<void> | undefined
  const emptySnapshot: AutoRoutes = {
    pages: [],
    entries: [],
    subPackages: [],
  }
  let lastWrittenTypedDefinition: string | undefined

  function isEnabled() {
    return ctx.configService?.weappViteConfig?.autoRoutes === true
  }

  function resetState() {
    updateRoutesReference(state.routes, emptySnapshot)
    state.serialized = JSON.stringify(emptySnapshot, null, 2)
    state.typedDefinition = createTypedRouterDefinition(emptySnapshot)
    state.moduleCode = [
      'const routes = ',
      state.serialized,
      ';',
      'const pages = routes.pages;',
      'const entries = routes.entries;',
      'const subPackages = routes.subPackages;',
      'export { routes, pages, entries, subPackages };',
      'export default routes;',
    ].join('\n')
    updateWatchTargets(state.watchFiles, new Set())
    updateWatchTargets(state.watchDirs, new Set())
    state.dirty = false
    state.initialized = true
    pendingScan = undefined
  }

  function resolveTypedRouterOutputPath() {
    const configService = ctx.configService
    if (!configService) {
      return undefined
    }

    const baseDir = typeof configService.configFilePath === 'string'
      ? path.dirname(configService.configFilePath)
      : configService.cwd

    if (!baseDir) {
      return undefined
    }

    return path.resolve(baseDir, 'typed-router.d.ts')
  }

  async function writeTypedRouterDefinition() {
    if (!isEnabled()) {
      return
    }

    const outputPath = resolveTypedRouterOutputPath()
    if (!outputPath) {
      return
    }

    const nextContent = state.typedDefinition
    if (!nextContent || nextContent === lastWrittenTypedDefinition) {
      return
    }

    try {
      await fs.outputFile(outputPath, nextContent, 'utf8')
      lastWrittenTypedDefinition = nextContent
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`写入 typed-router.d.ts 失败: ${message}`)
    }
  }

  async function removeTypedRouterDefinition() {
    const outputPath = resolveTypedRouterOutputPath()
    if (!outputPath) {
      lastWrittenTypedDefinition = undefined
      return
    }

    try {
      if (await fs.pathExists(outputPath)) {
        await fs.remove(outputPath)
      }
      lastWrittenTypedDefinition = undefined
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`移除 typed-router.d.ts 失败: ${message}`)
    }
  }

  async function ensureFresh() {
    if (!isEnabled()) {
      if (state.dirty || !state.initialized || state.routes.pages.length > 0 || state.routes.entries.length > 0 || state.routes.subPackages.length > 0) {
        resetState()
      }
      await removeTypedRouterDefinition()
      return
    }

    if (!state.dirty) {
      await (pendingScan ?? Promise.resolve())
      await writeTypedRouterDefinition()
      return
    }

    if (!pendingScan) {
      pendingScan = scanRoutes(ctx)
        .then((result) => {
          updateRoutesReference(state.routes, result.snapshot)
          state.serialized = result.serialized
          state.moduleCode = result.moduleCode
          state.typedDefinition = result.typedDefinition
          updateWatchTargets(state.watchFiles, result.watchFiles)
          updateWatchTargets(state.watchDirs, result.watchDirs)
          state.dirty = false
          state.initialized = true
        })
        .finally(() => {
          pendingScan = undefined
        })
    }

    await pendingScan
    await writeTypedRouterDefinition()
  }

  return {
    async ensureFresh() {
      await ensureFresh()
    },

    markDirty() {
      state.dirty = true
    },

    getSnapshot() {
      return cloneRoutes(state.routes)
    },

    getReference() {
      return state.routes
    },

    getModuleCode() {
      return state.moduleCode
    },

    getWatchFiles() {
      return state.watchFiles.values()
    },

    getWatchDirectories() {
      return state.watchDirs.values()
    },

    isRouteFile(filePath: string) {
      return isEnabled() && matchesRouteFile(ctx, filePath)
    },

    async handleFileChange(filePath: string) {
      if (!isEnabled()) {
        return
      }

      if (!matchesRouteFile(ctx, filePath)) {
        return
      }

      state.dirty = true
      await ensureFresh()
    },

    isInitialized() {
      return state.initialized && !state.dirty
    },

    isEnabled() {
      return isEnabled()
    },
  }
}

export function createAutoRoutesServicePlugin(ctx: MutableCompilerContext): Plugin {
  const service = createAutoRoutesService(ctx)
  ctx.autoRoutesService = service

  return {
    name: 'weapp-runtime:auto-routes-service',
  }
}
