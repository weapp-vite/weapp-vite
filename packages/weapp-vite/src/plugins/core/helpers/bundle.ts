import type { OutputAsset, OutputBundle, OutputChunk } from 'rolldown'
import type { CompilerContext } from '../../../context'
import type { CorePluginState, RemoveImplicitPagePreloadOptions } from './types'
import { Buffer } from 'node:buffer'
import { isEmptyObject, isObject } from '@weapp-core/shared'
import MagicString from 'magic-string'
import path from 'pathe'
import { changeFileExtension } from '../../../utils/file'
import { resolveCompilerOutputExtensions } from '../../../utils/outputExtensions'
import { isPathInside, normalizeRelativePath } from '../../../utils/path'
import { emitJsonAsset } from '../../utils/wxmlEmit'

const IMPLICIT_REQUIRE_RE = /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*require\((`[^`]+`|'[^']+'|"[^"]+")\);?/g
const REQUIRE_CALL_RE = /\brequire\((`[^`]+`|'[^']+'|"[^"]+")\)/g
const WEVU_SRC_CHUNK_RE = /(?:^|\/)wevu-src\.js$/
const WEVU_VENDOR_RUNTIME_CHUNK_RE = /(?:^|\/)weapp-vendors\/wevu-[^/]+\.js$/
const WEVU_EXPORT_ALIASES = [
  ['defineComponent', '__wevuDefineComponent'],
  ['createWevuComponent', '__wevuCreateWevuComponent'],
] as const
const WEVU_SYNTHETIC_SINGLE_PAGE_HOOK_EXPORTS = [
  'onAddToFavorites',
  'onSaveExitState',
  'onShareAppMessage',
  'onShareTimeline',
] as const
const WEVU_INTERNAL_REACTIVITY_EXPORTS = [
  'addMutationRecorder',
  'batch',
  'computed',
  'customRef',
  'effect',
  'effectScope',
  'endBatch',
  'getCurrentScope',
  'getDeepWatchStrategy',
  'getReactiveVersion',
  'isProxy',
  'isRaw',
  'isReactive',
  'isReadonly',
  'isRef',
  'isShallowReactive',
  'isShallowRef',
  'markRaw',
  'nextTick',
  'onScopeDispose',
  'prelinkReactiveTree',
  'reactive',
  'readonly',
  'ref',
  'removeMutationRecorder',
  'setDeepWatchStrategy',
  'shallowReactive',
  'shallowReadonly',
  'shallowRef',
  'startBatch',
  'stop',
  'toRaw',
  'toRef',
  'toRefs',
  'toValue',
  'touchReactive',
  'traverse',
  'triggerRef',
  'unref',
  'watch',
  'watchEffect',
  'watchPostEffect',
  'watchSyncEffect',
] as const
const WEVU_INTERNAL_TEMPLATE_EXPORTS = [
  'normalizeClass',
  'normalizeStyle',
  'resolvePropValue',
] as const
const WEVU_INTERNAL_RUNTIME_EXPORTS = [
  'callHookList',
  'callHookReturn',
  'createApp',
  'createWevuComponent',
  'createWevuScopedSlotComponent',
  'defineAppSetup',
  'defineComponent',
  'getCurrentInstance',
  'getCurrentPageStackSnapshot',
  'getCurrentSetupContext',
  'getNavigationBarMetrics',
  'hasInjectionContext',
  'inject',
  'injectGlobal',
  'isNoSetData',
  'markNoSetData',
  'mergeModels',
  'mountRuntimeInstance',
  'onActivated',
  'onAddToFavorites',
  'onAttached',
  'onBeforeMount',
  'onBeforeUnmount',
  'onBeforeUpdate',
  'onDeactivated',
  'onDetached',
  'onError',
  'onErrorCaptured',
  'onHide',
  'onLaunch',
  'onLoad',
  'onMemoryWarning',
  'onMounted',
  'onMoved',
  'onPageNotFound',
  'onPageScroll',
  'onPullDownRefresh',
  'onReachBottom',
  'onReady',
  'onResize',
  'onRouteDone',
  'onSaveExitState',
  'onServerPrefetch',
  'onShareAppMessage',
  'onShareTimeline',
  'onShow',
  'onTabItemTap',
  'onThemeChange',
  'onUnhandledRejection',
  'onUnload',
  'onUnmounted',
  'onUpdated',
  'provide',
  'provideGlobal',
  'registerApp',
  'registerComponent',
  'resetWevuDefaults',
  'resolveLayoutBridge',
  'resolveLayoutHost',
  'resolveRuntimePageLayoutName',
  'runSetupFunction',
  'setCurrentInstance',
  'setCurrentSetupContext',
  'setGlobalProvidedValue',
  'setPageLayout',
  'setRuntimeSetDataVisibility',
  'setWevuDefaults',
  'syncRuntimePageLayoutState',
  'syncRuntimePageLayoutStateFromRuntime',
  'teardownRuntimeInstance',
  'use',
  'useAsyncPullDownRefresh',
  'useAttrs',
  'useBindModel',
  'useBoundingClientRect',
  'useChangeModel',
  'useDisposables',
  'useElementIntersectionObserver',
  'useIntersectionObserver',
  'useLayoutBridge',
  'useLayoutHosts',
  'useModel',
  'useNativeInstance',
  'useNativePageRouter',
  'useNativeRouter',
  'useNavigationBarMetrics',
  'usePageLayout',
  'usePageScrollThrottle',
  'usePageStack',
  'useScrollOffset',
  'useSelectorFields',
  'useSelectorQuery',
  'useSlots',
  'useTemplateRef',
  'useUpdatePerformanceListener',
  'version',
  'waitForLayoutHost',
] as const
const WEVU_INTERNAL_MODULE_IDS = [
  'wevu/internal-runtime',
  'wevu/internal-reactivity',
  'wevu/internal-template',
] as const
type WevuInternalModuleId = (typeof WEVU_INTERNAL_MODULE_IDS)[number]
const WEVU_RUNTIME_MODULE_IDS = [
  'wevu',
  'wevu/router',
  'wevu/store',
  'wevu/api',
  'wevu/fetch',
  'wevu/web-apis',
  ...WEVU_INTERNAL_MODULE_IDS,
] as const
type WevuRuntimeModuleId = (typeof WEVU_RUNTIME_MODULE_IDS)[number]
interface WevuRuntimeChunkUsage {
  chunk: OutputChunk
  runtimeRefs: Set<string>
  inlineMembers: Set<string>
  members: Set<string>
}
interface WevuRuntimeChunkIndex {
  vendorChunks: OutputChunk[]
  chunksByModuleId: Map<string, OutputChunk>
  exportNamesByFileName: Map<string, Set<string>>
}
const WEVU_INTERNAL_MODULE_EXPORT_MARKERS: Record<WevuInternalModuleId, readonly string[]> = {
  'wevu/internal-runtime': WEVU_INTERNAL_RUNTIME_EXPORTS,
  'wevu/internal-reactivity': WEVU_INTERNAL_REACTIVITY_EXPORTS,
  'wevu/internal-template': WEVU_INTERNAL_TEMPLATE_EXPORTS,
}
const WEVU_RUNTIME_MODULE_EXPORT_MARKERS: Record<WevuRuntimeModuleId, readonly string[]> = {
  'wevu': WEVU_INTERNAL_RUNTIME_EXPORTS,
  'wevu/router': [
    'createRouter',
    'useRouter',
    'useRoute',
    'NavigationFailureType',
  ],
  'wevu/store': [
    'defineStore',
    'createPinia',
    'storeToRefs',
  ],
  'wevu/api': [
    'createApi',
    'defineApi',
  ],
  'wevu/fetch': [
    'createFetch',
    'useFetch',
  ],
  'wevu/web-apis': [
    'installWebApis',
    'createWebApis',
  ],
  ...WEVU_INTERNAL_MODULE_EXPORT_MARKERS,
}
const WEVU_INTERNAL_REACTIVITY_EXPORT_SET = new Set<string>(WEVU_INTERNAL_REACTIVITY_EXPORTS)
const WEVU_INTERNAL_TEMPLATE_EXPORT_SET = new Set<string>(WEVU_INTERNAL_TEMPLATE_EXPORTS)
const WEVU_INTERNAL_RUNTIME_EXPORT_SET = new Set<string>(WEVU_INTERNAL_RUNTIME_EXPORTS)
const JS_IDENTIFIER_RE = /^[A-Z_$][\w$]*$/i

export function filterPluginBundleOutputs(
  bundle: OutputBundle,
  configService: CompilerContext['configService'],
) {
  if (configService.pluginOnly) {
    return
  }

  const pluginOutputRoot = configService.absolutePluginOutputRoot
  const pluginRoot = configService.absolutePluginRoot
  const pluginBase = pluginRoot ? path.basename(pluginRoot) : 'plugin'
  const relativeToOutDir = pluginOutputRoot
    ? path.relative(configService.outDir, pluginOutputRoot)
    : ''
  const isPluginOutputInsideOutDir = pluginOutputRoot
    ? relativeToOutDir === '' || (!relativeToOutDir.startsWith('..') && !path.isAbsolute(relativeToOutDir))
    : false
  const pluginBundleBase = pluginOutputRoot && isPluginOutputInsideOutDir
    ? normalizeRelativePath(relativeToOutDir) || pluginBase
    : pluginBase
  for (const [fileName, output] of Object.entries(bundle)) {
    const matchesPluginFileName = fileName === pluginBundleBase || fileName.startsWith(`${pluginBundleBase}/`)
    const matchesPluginSource = output.type === 'chunk'
      ? isPathInside(pluginRoot, output.facadeModuleId ?? '')
      : (output.originalFileNames ?? []).some(originalFile => isPathInside(pluginRoot, originalFile))
    const isPluginFile = matchesPluginFileName || matchesPluginSource
    if (!isPluginFile) {
      delete bundle[fileName]
    }
  }
}

export function emitJsonAssets(this: any, state: CorePluginState) {
  const { ctx } = state
  const { jsonService, configService } = ctx
  const emittedSourceCache = ctx.runtimeState.json.emittedSource

  for (const jsonEmitFile of state.jsonEmitFilesMap.values()) {
    if (
      jsonEmitFile.entry.json
      && isObject(jsonEmitFile.entry.json)
      && !isEmptyObject(jsonEmitFile.entry.json)
    ) {
      const source = jsonService.resolve(jsonEmitFile.entry)
      if (source && jsonEmitFile.fileName) {
        const normalizedFileName = changeFileExtension(
          jsonEmitFile.fileName,
          resolveCompilerOutputExtensions(configService?.outputExtensions).jsonExtension,
        )
        if (emittedSourceCache.get(normalizedFileName) === source) {
          continue
        }

        const { jsonExtension } = resolveCompilerOutputExtensions(configService?.outputExtensions)
        emitJsonAsset(
          {
            emitFile: (asset) => {
              this.emitFile(asset)
            },
          },
          jsonEmitFile.fileName,
          source,
          jsonExtension,
        )
        emittedSourceCache.set(normalizedFileName, source)
      }
    }
  }
}

interface RemovalRange {
  start: number
  end: number
}

export interface RewriteWevuInternalRuntimeImportsOptions {
  runtimeFileName?: string
  runtimeFileNames?: Map<string, string>
  onRuntimeFileName?: (fileName: string) => void
  onRuntimeModuleFileName?: (moduleId: string, fileName: string) => void
}

function stripQuotes(value: string) {
  if (!value) {
    return value
  }
  const first = value[0]
  const last = value[value.length - 1]
  if ((first === last && (first === '"' || first === '\'')) || (first === '`' && last === '`')) {
    return value.slice(1, -1)
  }
  return value
}

function resolveRelativeImport(fromFile: string, specifier: string) {
  if (!specifier) {
    return ''
  }
  const dir = path.posix.dirname(fromFile)
  const absolute = path.posix.resolve('/', dir, specifier)
  return absolute.startsWith('/') ? absolute.slice(1) : absolute
}

function normalizeRelativeRequireSpecifier(fromFile: string, targetFile: string) {
  const relative = path.posix.relative(path.posix.dirname(fromFile), targetFile)
  return relative.startsWith('.') ? relative : `./${relative}`
}

function findImplicitRequireRemovalRanges(
  chunk: OutputChunk,
  targetFileNames: Set<string>,
): RemovalRange[] {
  const code = chunk.code
  const ranges: RemovalRange[] = []

  for (const match of code.matchAll(IMPLICIT_REQUIRE_RE)) {
    const specifier = stripQuotes(match[1])
    const resolved = resolveRelativeImport(chunk.fileName, specifier)

    if (!resolved || !targetFileNames.has(resolved)) {
      continue
    }

    const start = match.index
    const end = start + match[0].length
    ranges.push({ start, end })
  }

  return ranges
}

export function removeImplicitPagePreloads(
  bundle: OutputBundle,
  options: RemoveImplicitPagePreloadOptions,
) {
  const { configService, entriesMap } = options
  if (!entriesMap || entriesMap.size === 0) {
    return
  }

  const requireChunks: OutputChunk[] = []
  for (const chunk of Object.values(bundle)) {
    if (!chunk || chunk.type !== 'chunk' || typeof chunk.code !== 'string') {
      continue
    }
    if (!chunk.code.includes('require(')) {
      continue
    }
    requireChunks.push(chunk)
  }
  if (!requireChunks.length) {
    return
  }

  const pageChunkFileNames = new Set<string>()
  for (const entry of entriesMap.values()) {
    if (!entry || entry.type !== 'page') {
      continue
    }
    const relative = configService.relativeAbsoluteSrcRoot(entry.path)
    const outputFile = changeFileExtension(relative, '.js')
    pageChunkFileNames.add(outputFile)
  }

  if (pageChunkFileNames.size === 0) {
    return
  }

  for (const chunk of requireChunks) {
    let targetSet: Set<string> | undefined
    const addTargetFileName = (fileName: string) => {
      if (!pageChunkFileNames.has(fileName)) {
        return
      }
      targetSet ??= new Set<string>()
      targetSet.add(fileName)
    }

    if (Array.isArray(chunk.imports)) {
      for (const imported of chunk.imports) {
        addTargetFileName(imported)
      }
    }

    const rawImplicit = (chunk as any).implicitlyLoadedBefore
    const implicitlyLoaded = Array.isArray(rawImplicit) ? rawImplicit : undefined

    if (implicitlyLoaded) {
      for (const eager of implicitlyLoaded) {
        addTargetFileName(eager)
      }
    }

    if (!targetSet?.size) {
      continue
    }

    const ranges = findImplicitRequireRemovalRanges(chunk, targetSet)
    if (!ranges.length) {
      continue
    }

    const ms = new MagicString(chunk.code)
    for (const { start, end } of ranges) {
      ms.remove(start, end)
    }
    chunk.code = ms.toString()

    if (Array.isArray(chunk.imports) && chunk.imports.length) {
      chunk.imports = chunk.imports.filter(name => !targetSet.has(name))
    }
    if (implicitlyLoaded && implicitlyLoaded.length) {
      (chunk as any).implicitlyLoadedBefore = implicitlyLoaded.filter(name => !targetSet.has(name))
    }
  }
}

export function syncChunkImportsFromRequireCalls(bundle: OutputBundle) {
  const requireChunks: OutputChunk[] = []
  const chunkFileNames = new Set<string>()
  for (const output of Object.values(bundle)) {
    if (!output || output.type !== 'chunk' || typeof output.code !== 'string') {
      continue
    }
    chunkFileNames.add(output.fileName)
    if (output.code.includes('require(')) {
      requireChunks.push(output as OutputChunk)
    }
  }
  if (!requireChunks.length) {
    return
  }

  for (const chunk of requireChunks) {
    const nextImports = new Set(Array.isArray(chunk.imports) ? chunk.imports : [])
    let importsChanged = false

    for (const match of chunk.code.matchAll(REQUIRE_CALL_RE)) {
      const specifier = stripQuotes(match[1])
      if (!specifier.startsWith('.')) {
        continue
      }

      const resolved = resolveRelativeImport(chunk.fileName, specifier)
      if (!resolved || resolved === chunk.fileName || !chunkFileNames.has(resolved)) {
        continue
      }

      if (!nextImports.has(resolved)) {
        importsChanged = true
      }
      nextImports.add(resolved)
    }

    if (importsChanged) {
      chunk.imports = [...nextImports]
    }
  }
}

function parseNamedImportBindings(importClause: string) {
  return importClause
    .split(',')
    .map((segment) => {
      const trimmed = segment.trim()
      if (!trimmed) {
        return undefined
      }
      const [imported, local] = trimmed.split(/\s+as\s+/)
      const importedName = imported?.trim()
      const localName = local?.trim() || importedName
      if (!importedName || !localName) {
        return undefined
      }
      return {
        importedName,
        localName,
      }
    })
    .filter((item): item is { importedName: string, localName: string } => Boolean(item))
}

function collectExistingExportNames(code: string) {
  return new Set(
    Array.from(
      code.matchAll(/Object\.defineProperty\(exports,\s*["']([^"']+)["']/g),
      match => match[1],
    ),
  )
}

function collectChunkExportNames(chunk: OutputChunk) {
  return collectExistingExportNames(chunk.code)
}

function isWevuRuntimeModuleId(value: string): value is WevuRuntimeModuleId {
  return (WEVU_RUNTIME_MODULE_IDS as readonly string[]).includes(value)
}

function resolveWevuInternalChunk(
  bundle: OutputBundle,
  importNames: Iterable<string>,
) {
  const requiredNames = new Set(importNames)
  if (!requiredNames.size) {
    return undefined
  }

  return Object.values(bundle).find((output): output is OutputChunk => {
    if (!output || output.type !== 'chunk' || typeof output.code !== 'string' || !output.fileName.startsWith('weapp-vendors/')) {
      return false
    }
    const exports = collectChunkExportNames(output as OutputChunk)
    return [...requiredNames].every(name => exports.has(name))
  })
}

function createWevuRuntimeChunkIndex(bundle: OutputBundle): WevuRuntimeChunkIndex {
  const vendorChunks: OutputChunk[] = []
  const chunksByModuleId = new Map<string, OutputChunk>()
  const exportNamesByFileName = new Map<string, Set<string>>()

  for (const output of Object.values(bundle)) {
    if (
      !output
      || output.type !== 'chunk'
      || typeof output.code !== 'string'
      || !output.fileName.startsWith('weapp-vendors/')
    ) {
      continue
    }

    const chunk = output as OutputChunk
    vendorChunks.push(chunk)
    const normalizedFileName = chunk.fileName.replace(/\\/g, '/')
    for (const moduleId of WEVU_RUNTIME_MODULE_IDS) {
      const chunkFileName = moduleId.replace(/\//g, '-')
      const isMatch = moduleId === 'wevu'
        ? normalizedFileName.endsWith(`${chunkFileName}.js`)
        : normalizedFileName.endsWith(`${chunkFileName}.js`)
          || normalizedFileName.includes(`/${chunkFileName}-`)
      if (isMatch && !chunksByModuleId.has(moduleId)) {
        chunksByModuleId.set(moduleId, chunk)
      }
    }
  }

  return {
    vendorChunks,
    chunksByModuleId,
    exportNamesByFileName,
  }
}

function getWevuRuntimeChunkExportNames(
  index: WevuRuntimeChunkIndex,
  chunk: OutputChunk,
) {
  let exports = index.exportNamesByFileName.get(chunk.fileName)
  if (!exports) {
    exports = collectChunkExportNames(chunk)
    index.exportNamesByFileName.set(chunk.fileName, exports)
  }
  return exports
}

function resolveIndexedWevuInternalChunk(
  index: WevuRuntimeChunkIndex,
  importNames: Iterable<string>,
) {
  const requiredNames = new Set(importNames)
  if (!requiredNames.size) {
    return undefined
  }

  return index.vendorChunks.find((chunk) => {
    const exports = getWevuRuntimeChunkExportNames(index, chunk)
    return [...requiredNames].every(name => exports.has(name))
  })
}

function resolveIndexedWevuInternalChunkByExportMarkers(
  index: WevuRuntimeChunkIndex,
  markers: Iterable<string>,
  excludedFileNames: Set<string>,
) {
  const markerSet = new Set(markers)
  if (!markerSet.size) {
    return undefined
  }

  return index.vendorChunks.find((chunk) => {
    if (excludedFileNames.has(chunk.fileName)) {
      return false
    }
    const exports = getWevuRuntimeChunkExportNames(index, chunk)
    return [...markerSet].some(name => exports.has(name))
  })
}

function rememberWevuRuntimeChunk(
  moduleId: string,
  chunk: OutputChunk | undefined,
  options: RewriteWevuInternalRuntimeImportsOptions,
) {
  if (!chunk?.fileName) {
    return
  }
  if (moduleId === 'wevu/internal-runtime') {
    options.onRuntimeFileName?.(chunk.fileName)
  }
  options.onRuntimeModuleFileName?.(moduleId, chunk.fileName)
}

function rememberCurrentWevuRuntimeChunks(
  index: WevuRuntimeChunkIndex,
  options: RewriteWevuInternalRuntimeImportsOptions,
) {
  const rememberedFileNames = new Set<string>()
  for (const moduleId of WEVU_RUNTIME_MODULE_IDS) {
    if (moduleId === 'wevu') {
      continue
    }
    const exactChunk = index.chunksByModuleId.get(moduleId)
    const chunk = exactChunk ?? resolveIndexedWevuInternalChunkByExportMarkers(
      index,
      WEVU_RUNTIME_MODULE_EXPORT_MARKERS[moduleId],
      rememberedFileNames,
    )
    rememberWevuRuntimeChunk(moduleId, chunk, options)
    if (chunk?.fileName) {
      rememberedFileNames.add(chunk.fileName)
    }
  }
}

function resolveOutputCode(output: OutputAsset | OutputChunk) {
  if (output.type === 'chunk') {
    return output.code
  }
  if (typeof output.source === 'string') {
    return output.source
  }
  if (output.source == null) {
    return undefined
  }
  return Buffer.from(output.source).toString()
}

function updateOutputCode(output: OutputAsset | OutputChunk, code: string) {
  if (output.type === 'chunk') {
    output.code = code
    return
  }
  output.source = code
}

function formatNamedRequireBindings(bindings: Array<{ importedName: string, localName: string }>) {
  return bindings
    .map(({ importedName, localName }) => {
      return importedName === localName
        ? importedName
        : `${importedName}: ${localName}`
    })
    .join(', ')
}

function resolveRootWevuInternalModuleId(importedName: string): WevuInternalModuleId | undefined {
  if (WEVU_INTERNAL_REACTIVITY_EXPORT_SET.has(importedName)) {
    return 'wevu/internal-reactivity'
  }
  if (WEVU_INTERNAL_TEMPLATE_EXPORT_SET.has(importedName)) {
    return 'wevu/internal-template'
  }
  if (WEVU_INTERNAL_RUNTIME_EXPORT_SET.has(importedName)) {
    return 'wevu/internal-runtime'
  }
  return undefined
}

function resolveWevuRuntimeChunkForModuleId(
  index: WevuRuntimeChunkIndex,
  moduleId: WevuRuntimeModuleId,
  importedNames: Iterable<string>,
) {
  return index.chunksByModuleId.get(moduleId)
    ?? resolveIndexedWevuInternalChunk(index, importedNames)
}

function resolveRememberedWevuRuntimeFileName(
  moduleId: WevuRuntimeModuleId,
  importedNames: Iterable<string>,
  options: RewriteWevuInternalRuntimeImportsOptions,
) {
  const names = [...importedNames]
  const canUseLegacyRuntimeFileName = moduleId === 'wevu/internal-runtime'
    && names.every(importedName => WEVU_INTERNAL_RUNTIME_EXPORT_SET.has(importedName))
  return options.runtimeFileNames?.get(moduleId)
    ?? (canUseLegacyRuntimeFileName ? options.runtimeFileName : undefined)
}

function formatWevuRuntimeRequire(
  fileName: string,
  runtimeFileName: string,
  bindings: Array<{ importedName: string, localName: string }>,
) {
  const specifier = normalizeRelativeRequireSpecifier(fileName, runtimeFileName)
  return `const { ${formatNamedRequireBindings(bindings)} } = require(${JSON.stringify(specifier)});`
}

function rewriteRootWevuImport(
  index: WevuRuntimeChunkIndex,
  fileName: string,
  full: string,
  bindings: Array<{ importedName: string, localName: string }>,
  options: RewriteWevuInternalRuntimeImportsOptions,
  requiredRuntimeFileNames: Set<string>,
) {
  const groupedBindings = new Map<WevuInternalModuleId, Array<{ importedName: string, localName: string }>>()
  const remainingBindings: Array<{ importedName: string, localName: string }> = []

  for (const binding of bindings) {
    const moduleId = resolveRootWevuInternalModuleId(binding.importedName)
    if (!moduleId) {
      remainingBindings.push(binding)
      continue
    }
    const group = groupedBindings.get(moduleId) ?? []
    group.push(binding)
    groupedBindings.set(moduleId, group)
  }

  if (!groupedBindings.size) {
    return { code: full, changed: false }
  }

  const statements: string[] = []
  for (const [moduleId, moduleBindings] of groupedBindings) {
    const importedNames = moduleBindings.map(binding => binding.importedName)
    const runtimeChunk = resolveWevuRuntimeChunkForModuleId(index, moduleId, importedNames)
    const runtimeFileName = runtimeChunk?.fileName
      ?? resolveRememberedWevuRuntimeFileName(moduleId, importedNames, options)
    if (!runtimeFileName) {
      return { code: full, changed: false }
    }
    rememberWevuRuntimeChunk(moduleId, runtimeChunk, options)
    requiredRuntimeFileNames.add(runtimeFileName)
    statements.push(formatWevuRuntimeRequire(fileName, runtimeFileName, moduleBindings))
  }

  if (remainingBindings.length) {
    statements.push(`import { ${remainingBindings.map(({ importedName, localName }) => {
      return importedName === localName
        ? importedName
        : `${importedName} as ${localName}`
    }).join(', ')} } from "wevu";`)
  }

  return {
    code: statements.join('\n'),
    changed: true,
  }
}

function mayContainWevuRuntimeImport(code: string) {
  return code.includes('wevu/internal-runtime')
    || code.includes('wevu/internal-reactivity')
    || code.includes('wevu/internal-template')
    || code.includes('wevu/router')
    || code.includes('wevu/store')
    || code.includes('wevu/api')
    || code.includes('wevu/fetch')
    || code.includes('wevu/web-apis')
    || code.includes('from \'wevu\'')
    || code.includes('from "wevu"')
    || code.includes('require(\'wevu')
    || code.includes('require("wevu')
    || code.includes('require(`wevu')
}

export function rewriteWevuInternalRuntimeImports(
  bundle: OutputBundle,
  options: RewriteWevuInternalRuntimeImportsOptions = {},
) {
  const importRe = /\bimport\s*\{([^}]*)\}\s*from\s*["'](wevu(?:\/(?:router|store|api|fetch|web-apis|internal-(?:runtime|reactivity|template)))?)["'];?/g
  const requireRe = /\brequire\(\s*(`wevu(?:\/(?:router|store|api|fetch|web-apis|internal-(?:runtime|reactivity|template)))?`|'wevu(?:\/(?:router|store|api|fetch|web-apis|internal-(?:runtime|reactivity|template)))?'|"wevu(?:\/(?:router|store|api|fetch|web-apis|internal-(?:runtime|reactivity|template)))?")\s*\)/g
  const runtimeChunkIndex = createWevuRuntimeChunkIndex(bundle)
  const currentRuntimeChunk = resolveIndexedWevuInternalChunk(runtimeChunkIndex, WEVU_INTERNAL_RUNTIME_EXPORTS)
  if (currentRuntimeChunk) {
    rememberWevuRuntimeChunk('wevu/internal-runtime', currentRuntimeChunk, options)
  }
  rememberCurrentWevuRuntimeChunks(runtimeChunkIndex, options)

  for (const output of Object.values(bundle)) {
    if (!output || (output.type !== 'chunk' && output.type !== 'asset')) {
      continue
    }
    const code = resolveOutputCode(output as OutputAsset | OutputChunk)
    if (typeof code !== 'string') {
      continue
    }

    const fileName = output.fileName
    if (!fileName.endsWith('.js')) {
      continue
    }
    if (!mayContainWevuRuntimeImport(code)) {
      continue
    }

    let rewritten = code
    let changed = false
    const requiredRuntimeFileNames = new Set<string>()

    rewritten = rewritten.replace(importRe, (full, importClause: string, source: string) => {
      const bindings = parseNamedImportBindings(importClause)
      const importedNames = bindings.map(binding => binding.importedName)
      if (source === 'wevu') {
        const result = rewriteRootWevuImport(
          runtimeChunkIndex,
          fileName,
          full,
          bindings,
          options,
          requiredRuntimeFileNames,
        )
        changed ||= result.changed
        return result.code
      }

      const resolvedInternalModuleId = source as WevuRuntimeModuleId
      const runtimeChunk = resolveWevuRuntimeChunkForModuleId(runtimeChunkIndex, resolvedInternalModuleId, importedNames)
      const rememberedRuntimeFileName = resolveRememberedWevuRuntimeFileName(
        resolvedInternalModuleId,
        importedNames,
        options,
      )
      const runtimeFileName = runtimeChunk?.fileName ?? rememberedRuntimeFileName
      if (!runtimeFileName) {
        return full
      }
      rememberWevuRuntimeChunk(resolvedInternalModuleId, runtimeChunk, options)

      changed = true
      requiredRuntimeFileNames.add(runtimeFileName)
      const specifier = normalizeRelativeRequireSpecifier(fileName, runtimeFileName)
      return `const { ${formatNamedRequireBindings(bindings)} } = require(${JSON.stringify(specifier)});`
    })

    rewritten = rewritten.replace(requireRe, (full, rawSpecifier: string) => {
      const specifierValue = stripQuotes(rawSpecifier)
      const canUseRememberedRuntime = specifierValue === 'wevu/internal-runtime'
        || (specifierValue === 'wevu' && WEVU_INTERNAL_RUNTIME_EXPORTS.some(exportName => new RegExp(`\\b${exportName}\\b`).test(code)))
      const rememberedRuntimeFileName = isWevuRuntimeModuleId(specifierValue)
        ? options.runtimeFileNames?.get(specifierValue)
        : undefined
      const runtimeFileName = canUseRememberedRuntime
        ? (currentRuntimeChunk?.fileName ?? rememberedRuntimeFileName ?? options.runtimeFileName)
        : rememberedRuntimeFileName
      if (!runtimeFileName) {
        return full
      }

      changed = true
      requiredRuntimeFileNames.add(runtimeFileName)
      const specifier = normalizeRelativeRequireSpecifier(fileName, runtimeFileName)
      return `require(${JSON.stringify(specifier)})`
    })

    if (!changed) {
      continue
    }

    updateOutputCode(output as OutputAsset | OutputChunk, rewritten)
    if (output.type !== 'chunk') {
      continue
    }
    const chunk = output as OutputChunk
    const nextImports = new Set(Array.isArray(chunk.imports) ? chunk.imports : [])
    for (const runtimeFileName of requiredRuntimeFileNames) {
      nextImports.add(runtimeFileName)
    }
    for (const match of chunk.code.matchAll(REQUIRE_CALL_RE)) {
      const specifier = stripQuotes(match[1])
      const resolved = resolveRelativeImport(chunk.fileName, specifier)
      if (resolved && resolved !== chunk.fileName && bundle[resolved]?.type === 'chunk') {
        nextImports.add(resolved)
      }
    }
    chunk.imports = [...nextImports]
  }
}

export function rewriteWevuInternalRuntimeImportCode(
  fileName: string,
  code: string,
  runtimeFileNameOrOptions: string | RewriteWevuInternalRuntimeImportsOptions | undefined,
) {
  const options = typeof runtimeFileNameOrOptions === 'string'
    ? { runtimeFileName: runtimeFileNameOrOptions }
    : (runtimeFileNameOrOptions ?? {})
  if (
    (
      !options.runtimeFileName
      && !options.runtimeFileNames?.size
    )
    || !mayContainWevuRuntimeImport(code)
  ) {
    return code
  }
  const output = {
    type: 'asset',
    fileName,
    source: code,
  } as OutputAsset
  rewriteWevuInternalRuntimeImports({
    [fileName]: output,
  } as OutputBundle, options)
  return typeof output.source === 'string'
    ? output.source
    : Buffer.from(output.source).toString()
}

function resolveRequireTarget(fromFile: string, specifier: string) {
  if (!specifier.startsWith('.')) {
    return ''
  }
  return resolveRelativeImport(fromFile, specifier)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function collectLocalRuntimeIdentifiers(code: string) {
  const identifiers = new Set<string>()
  for (const match of code.matchAll(/\b(?:function|class)\s+([A-Za-z_$][\w$]*)\b/g)) {
    identifiers.add(match[1])
  }
  for (const match of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) {
    identifiers.add(match[1])
  }
  return identifiers
}

function resolveWevuExportAliasMap(wevuChunk: OutputChunk) {
  const aliases = new Map<string, string>()
  const code = wevuChunk.code
  const localIdentifiers = collectLocalRuntimeIdentifiers(code)

  for (const [exportName] of WEVU_EXPORT_ALIASES) {
    const exportRe = new RegExp(`\\b([A-Za-z_$][\\w$]*)\\s+as\\s+${exportName}\\b`)
    const exportMatch = exportRe.exec(code)
    if (exportMatch?.[1]) {
      aliases.set(exportName, exportMatch[1])
    }
  }

  const propertyExports = Array.from(
    code.matchAll(/Object\.defineProperty\(exports,\s*["']([^"']+)["'][\s\S]*?return\s+([A-Za-z_$][\w$]*)\s*(?:;\s*)?\}/g),
  )
  for (const [exportName] of WEVU_EXPORT_ALIASES) {
    if (aliases.has(exportName)) {
      continue
    }
    const semanticExport = propertyExports.find(match => match[1] === exportName)
    if (semanticExport?.[2]) {
      aliases.set(exportName, semanticExport[2])
      continue
    }
    const stableExport = propertyExports.find(match => match[1] === `__wevu${exportName[0].toUpperCase()}${exportName.slice(1)}`)
    if (stableExport?.[2]) {
      aliases.set(exportName, stableExport[2])
      continue
    }
  }

  if (!aliases.has('defineComponent') && localIdentifiers.has('eo')) {
    aliases.set('defineComponent', 'eo')
  }
  if (!aliases.has('createWevuComponent') && localIdentifiers.has('to')) {
    aliases.set('createWevuComponent', 'to')
  }

  if (!aliases.has('defineComponent')) {
    const createWevuComponentExport = propertyExports.find(match => match[1] === 'createWevuComponent')
      ?? propertyExports.find(match => match[1] === '__wevuCreateWevuComponent')
    const createWevuComponentLocal = createWevuComponentExport?.[2]
    if (createWevuComponentLocal) {
      const functionRe = new RegExp(`function\\s+${createWevuComponentLocal}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]{0,500}?\\b([A-Za-z_$][\\w$]*)\\s*\\(`)
      const functionMatch = functionRe.exec(code)
      if (functionMatch?.[1]) {
        aliases.set('defineComponent', functionMatch[1])
      }
    }
  }

  return aliases
}

function getWevuRuntimeChunkUsage(
  usageByRuntimeChunk: Map<string, Map<string, WevuRuntimeChunkUsage>>,
  runtimeChunkFileName: string,
  chunk: OutputChunk,
) {
  let usageByChunk = usageByRuntimeChunk.get(runtimeChunkFileName)
  if (!usageByChunk) {
    usageByChunk = new Map()
    usageByRuntimeChunk.set(runtimeChunkFileName, usageByChunk)
  }

  let usage = usageByChunk.get(chunk.fileName)
  if (!usage) {
    usage = {
      chunk,
      runtimeRefs: new Set(),
      inlineMembers: new Set(),
      members: new Set(),
    }
    usageByChunk.set(chunk.fileName, usage)
  }

  return usage
}

function collectWevuRuntimeChunkUsage(
  bundle: OutputBundle,
  wevuChunkFileNames: Set<string>,
) {
  const usageByRuntimeChunk = new Map<string, Map<string, WevuRuntimeChunkUsage>>()
  if (!wevuChunkFileNames.size) {
    return usageByRuntimeChunk
  }

  for (const output of Object.values(bundle)) {
    if (!output || output.type !== 'chunk' || typeof output.code !== 'string') {
      continue
    }

    const chunk = output as OutputChunk
    const localRequireRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\((`[^`]+`|'[^']+'|"[^"]+")\);?/g
    for (const match of chunk.code.matchAll(localRequireRe)) {
      const resolved = resolveRequireTarget(chunk.fileName, stripQuotes(match[2]))
      if (!resolved || resolved === chunk.fileName || !wevuChunkFileNames.has(resolved)) {
        continue
      }

      getWevuRuntimeChunkUsage(usageByRuntimeChunk, resolved, chunk).runtimeRefs.add(match[1])
    }

    const inlineRequireRe = /require\((`[^`]+`|'[^']+'|"[^"]+")\)\.([A-Za-z_$][\w$]*)\b/g
    for (const match of chunk.code.matchAll(inlineRequireRe)) {
      const resolved = resolveRequireTarget(chunk.fileName, stripQuotes(match[1]))
      if (!resolved || resolved === chunk.fileName || !wevuChunkFileNames.has(resolved)) {
        continue
      }

      const usage = getWevuRuntimeChunkUsage(usageByRuntimeChunk, resolved, chunk)
      usage.inlineMembers.add(match[2])
      usage.members.add(match[2])
    }
  }

  for (const usageByChunk of usageByRuntimeChunk.values()) {
    for (const usage of usageByChunk.values()) {
      for (const ref of usage.runtimeRefs) {
        const memberRe = new RegExp(`\\b${escapeRegExp(ref)}\\.([A-Za-z_$][\\w$]*)\\b`, 'g')
        for (const match of usage.chunk.code.matchAll(memberRe)) {
          usage.members.add(match[1])
        }
      }
    }
  }

  return usageByRuntimeChunk
}

function collectImportedWevuRuntimeMembers(
  usageByChunk: Map<string, WevuRuntimeChunkUsage> | undefined,
) {
  const members = new Set<string>()
  for (const usage of usageByChunk?.values() ?? []) {
    for (const member of usage.members) {
      members.add(member)
    }
  }
  return members
}

function appendWevuRuntimeExports(
  chunk: OutputChunk,
  aliases: Map<string, string>,
  importedMembers: Set<string>,
) {
  const lines: string[] = []
  const existingExports = collectExistingExportNames(chunk.code)
  const localIdentifiers = collectLocalRuntimeIdentifiers(chunk.code)

  for (const [exportName, stableName] of WEVU_EXPORT_ALIASES) {
    const localName = aliases.get(exportName)
    if (!localName || existingExports.has(stableName)) {
      continue
    }
    lines.push(`Object.defineProperty(exports, ${JSON.stringify(stableName)}, { enumerable: false, get: function() { return ${localName}; } });`)
    existingExports.add(stableName)
  }

  for (const member of importedMembers) {
    if (!JS_IDENTIFIER_RE.test(member) || existingExports.has(member) || !localIdentifiers.has(member)) {
      continue
    }
    lines.push(`Object.defineProperty(exports, ${JSON.stringify(member)}, { enumerable: true, get: function() { return ${member}; } });`)
    existingExports.add(member)
  }

  if (lines.length) {
    chunk.code = `${chunk.code}\n${lines.join('\n')}`
  }
}

function formatSyntheticSinglePageHookExport(exportName: string) {
  return [
    `function ${exportName}(handler) {`,
    `\tconst instance = require_weapp_vendors_wevu_base.assertInSetup(${JSON.stringify(exportName)});`,
    `\trequire_weapp_vendors_wevu_base.pushHook(instance, ${JSON.stringify(exportName)}, handler, { single: true });`,
    `}`,
    `Object.defineProperty(exports, ${JSON.stringify(exportName)}, { enumerable: true, get: function() { return ${exportName}; } });`,
  ].join('\n')
}

function appendSyntheticWevuHookExports(chunk: OutputChunk, importedMembers: Set<string>) {
  if (!chunk.code.includes('require_weapp_vendors_wevu_base')) {
    return
  }

  const existingExports = collectExistingExportNames(chunk.code)
  const lines: string[] = []
  for (const exportName of WEVU_SYNTHETIC_SINGLE_PAGE_HOOK_EXPORTS) {
    if (!importedMembers.has(exportName) || existingExports.has(exportName)) {
      continue
    }
    lines.push(formatSyntheticSinglePageHookExport(exportName))
    existingExports.add(exportName)
  }

  if (lines.length) {
    chunk.code = `${chunk.code}\n${lines.join('\n')}`
  }
}

function resolveWevuBaseChunk(bundle: OutputBundle) {
  return resolveWevuInternalChunk(bundle, ['assertInSetup', 'pushHook'])
}

function formatSyntheticSinglePageHookFallback(
  hookName: string,
  receiverAccess: string,
  baseRequireSpecifier: string,
) {
  const baseRequire = `require(${JSON.stringify(baseRequireSpecifier)})`
  return `(${receiverAccess} || function(handler) { const instance = ${baseRequire}.assertInSetup(${JSON.stringify(hookName)}); ${baseRequire}.pushHook(instance, ${JSON.stringify(hookName)}, handler, { single: true }); })(`
}

function rewriteSyntheticWevuHookAccess(
  chunk: OutputChunk,
  wevuChunkFileName: string,
  baseChunkFileName: string,
  importedMembers: Set<string>,
  usage: WevuRuntimeChunkUsage,
) {
  const hookNames = WEVU_SYNTHETIC_SINGLE_PAGE_HOOK_EXPORTS.filter((name) => {
    return importedMembers.has(name) && usage.members.has(name)
  })
  if (!hookNames.length) {
    return
  }

  const baseRequireSpecifier = normalizeRelativeRequireSpecifier(chunk.fileName, baseChunkFileName)
  let nextCode = chunk.code

  for (const hookName of hookNames) {
    for (const ref of usage.runtimeRefs) {
      const memberRe = new RegExp(`\\b${escapeRegExp(ref)}\\.${hookName}\\s*\\(`, 'g')
      nextCode = nextCode.replace(memberRe, () => {
        return formatSyntheticSinglePageHookFallback(hookName, `${ref}.${hookName}`, baseRequireSpecifier)
      })
    }

    if (!usage.inlineMembers.has(hookName)) {
      continue
    }

    const inlineRequireRe = /require\((`[^`]+`|'[^']+'|"[^"]+")\)\.([A-Za-z_$][\w$]*)\s*\(/g
    nextCode = nextCode.replace(inlineRequireRe, (full, rawSpecifier: string, property: string) => {
      if (property !== hookName) {
        return full
      }
      const resolved = resolveRequireTarget(chunk.fileName, stripQuotes(rawSpecifier))
      if (resolved !== wevuChunkFileName) {
        return full
      }
      return formatSyntheticSinglePageHookFallback(
        hookName,
        `require(${rawSpecifier}).${hookName}`,
        baseRequireSpecifier,
      )
    })
  }

  chunk.code = nextCode
}

function rewriteStableWevuRuntimeAccess(
  chunk: OutputChunk,
  wevuChunkFileName: string,
  aliases: Map<string, string>,
  usage: WevuRuntimeChunkUsage,
) {
  if (!aliases.size) {
    return
  }

  let nextCode = chunk.code
  for (const [exportName, stableName] of WEVU_EXPORT_ALIASES) {
    const localName = aliases.get(exportName)
    if (!localName) {
      continue
    }
    if (usage.inlineMembers.has(localName) || usage.inlineMembers.has(stableName)) {
      const inlineRequireRe = /require\((`[^`]+`|'[^']+'|"[^"]+")\)\.([A-Za-z_$][\w$]*)\s*\(/g
      nextCode = nextCode.replace(inlineRequireRe, (full, rawSpecifier: string, property: string) => {
        if (property !== localName && property !== stableName) {
          return full
        }
        const resolved = resolveRequireTarget(chunk.fileName, stripQuotes(rawSpecifier))
        if (resolved !== wevuChunkFileName) {
          return full
        }
        return `(require(${rawSpecifier}).${stableName} || require(${rawSpecifier}).${property})(`
      })
    }

    if (!usage.members.has(localName) && !usage.members.has(stableName)) {
      continue
    }

    for (const ref of usage.runtimeRefs) {
      const memberRe = new RegExp(`\\b${escapeRegExp(ref)}\\.(?:${stableName}|${localName})\\s*\\(`, 'g')
      nextCode = nextCode.replace(memberRe, (full) => {
        const property = full.includes(`.${stableName}`) ? stableName : localName
        return `(${ref}.${stableName} || ${ref}.${property})(`
      })
    }
  }

  chunk.code = nextCode
}

export function stabilizeWevuRuntimeChunkAccess(bundle: OutputBundle) {
  const wevuChunks = Object.values(bundle).filter((output): output is OutputChunk => {
    return output?.type === 'chunk'
      && (
        WEVU_SRC_CHUNK_RE.test(output.fileName)
        || WEVU_VENDOR_RUNTIME_CHUNK_RE.test(output.fileName)
      )
  })
  if (!wevuChunks.length) {
    return
  }
  const baseChunk = resolveWevuBaseChunk(bundle)
  const usageByRuntimeChunk = collectWevuRuntimeChunkUsage(
    bundle,
    new Set(wevuChunks.map(chunk => chunk.fileName)),
  )

  for (const wevuChunk of wevuChunks) {
    const aliases = resolveWevuExportAliasMap(wevuChunk)
    const usageByChunk = usageByRuntimeChunk.get(wevuChunk.fileName)
    const importedMembers = collectImportedWevuRuntimeMembers(usageByChunk)

    appendWevuRuntimeExports(wevuChunk, aliases, importedMembers)
    appendSyntheticWevuHookExports(wevuChunk, importedMembers)
    for (const usage of usageByChunk?.values() ?? []) {
      const chunk = usage.chunk
      rewriteStableWevuRuntimeAccess(chunk, wevuChunk.fileName, aliases, usage)
      if (baseChunk?.fileName) {
        rewriteSyntheticWevuHookAccess(chunk, wevuChunk.fileName, baseChunk.fileName, importedMembers, usage)
        if (chunk.code.includes(normalizeRelativeRequireSpecifier(chunk.fileName, baseChunk.fileName))) {
          const nextImports = new Set(Array.isArray(chunk.imports) ? chunk.imports : [])
          nextImports.add(baseChunk.fileName)
          chunk.imports = [...nextImports]
        }
      }
    }
  }
}
