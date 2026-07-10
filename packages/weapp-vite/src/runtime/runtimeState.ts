import type { Plugin as PluginJson } from '@weapp-core/schematics'
import type { Buffer } from 'node:buffer'
import type { DetectResult } from 'package-manager-detector'
import type { ResolvedId, RolldownOutput } from 'rolldown'
import type { AppEntry, ChangeEvent, ComponentsMap, Entry, SubPackageMetaValue } from '../types'
import type { AutoRoutes } from '../types/routes'
import type { ScanWxmlResult } from '../wxml'
import type { LocalAutoImportMatch } from './autoImport/types'
import type { LoadConfigResult, PackageInfo } from './config/types'
import type { SidecarWatcher, WatcherInstance } from './watcher/types'
import process from 'node:process'
import PQueue from 'p-queue'
import { FileCache } from '../cache'
import { getOutputExtensions } from '../defaults'
import { resolveMultiPlatformConfig } from '../multiPlatform'
import { DEFAULT_MP_PLATFORM } from '../platform'
import { createAutoRoutesArtifacts, createEmptyAutoRoutesSnapshot } from './autoRoutesPlugin/service/shared'

interface AutoRoutesCandidateState {
  base: string
  files: Set<string>
  hasScript: boolean
  hasTemplate: boolean
  jsonPath?: string
}

interface LibEntryState {
  name: string
  input: string
  outputBase: string
  relativeBase: string
}

function createDefaultLoadConfigResult(): LoadConfigResult {
  return {
    config: {},
    loadOptions: {
      cwd: process.cwd(),
      isDev: false,
      mode: 'development',
      emitDefaultAutoImportOutputs: true,
    },
    aliasEntries: [],
    outputExtensions: getOutputExtensions(DEFAULT_MP_PLATFORM),
    packageJson: {},
    relativeSrcRoot: p => p,
    cwd: process.cwd(),
    isDev: false,
    mode: 'development',
    emitDefaultAutoImportOutputs: true,
    projectConfig: {},
    projectConfigPath: undefined,
    projectPrivateConfigPath: undefined,
    mpDistRoot: '',
    multiPlatform: resolveMultiPlatformConfig(false),
    weappLib: undefined,
    weappLibOutputMap: undefined,
    packageJsonPath: '',
    platform: DEFAULT_MP_PLATFORM,
    srcRoot: '',
    configFilePath: undefined,
    configFileDependencies: [],
    weappWeb: undefined,
    configMergeInfo: undefined,
  }
}

function createDefaultPackageInfo(): PackageInfo {
  return {
    name: '',
    version: undefined,
    rootPath: '',
    packageJsonPath: '',
    packageJson: {},
  }
}

function createDefaultPackageManager(): DetectResult {
  return {
    agent: 'npm',
    name: 'npm',
  }
}

export interface RuntimeState {
  autoRoutes: {
    routes: AutoRoutes
    serialized: string
    moduleCode: string
    typedDefinition: string
    watchFiles: Set<string>
    watchDirs: Set<string>
    dirty: boolean
    initialized: boolean
    candidates: Map<string, AutoRoutesCandidateState>
    needsFullRescan: boolean
    loadingAppConfig: boolean
  }
  autoImport: {
    registry: Map<string, LocalAutoImportMatch>
    resolvedResolverComponents: Map<string, string>
    matcher?: (input: string) => boolean
    matcherKey: string
    preparedGlobsKey?: string
    version: number
    pendingEntriesByImporter: Map<string, Set<string>>
  }
  build: {
    queue: PQueue
    npmBuilt: boolean
    independent: {
      outputs: Map<string, RolldownOutput>
    }
    output: {
      emittedSource: Map<string, string>
      wevuInternalRuntimeFileName?: string
      wevuInternalRuntimeFileNames?: Map<string, string>
    }
    hmr: {
      loadedEntrySet: Set<string>
      dirtyEntrySet: Set<string>
      dirtyEntryReasons: Map<string, 'direct' | 'dependency' | 'metadata'>
      resolvedEntryMap: Map<string, ResolvedId>
      externalComponentEntryMap: Map<string, string>
      entriesMap: Map<string, Entry | undefined>
      layoutEntryDependents: Map<string, Set<string>>
      entryLayoutDependencies: Map<string, Set<string>>
      vueEntryHasTemplate: Map<string, boolean>
      vueEntryNonJsonSignatures: Map<string, string>
      vueEntryScriptSignatures: Map<string, string>
      vueEntryStyleIndependentSignatures: Map<string, string>
      vueEntryTailwindContentSignatures: Map<string, string>
      vueEntryTailwindTemplateContentSignatures: Map<string, string>
      vueEntryTailwindScriptContentSignatures: Map<string, string>
      appEntryAutoRoutesSignature?: string
      dirtyVueEntryIds: Set<string>
      didEmitAllEntries: boolean
      lastHmrEntryIds: Set<string>
      lastEmittedEntryIds: Set<string>
      lastEmittedChunkFileNames: Set<string>
      sharedChunkSourceModuleIds: Set<string>
      recentProfiles: Array<{
        timestamp?: string
        totalMs: number
        eventId?: string
        event?: string
        file?: string
        relativeFile?: string
        sourceRootFile?: string
        buildCoreMs?: number
        buildStartMs?: number
        pluginResolveMs?: number
        transformMs?: number
        coreTransformMs?: number
        wevuTransformMs?: number
        vueTransformMs?: number
        vueReadSourceMs?: number
        vueCompileMs?: number
        vueFinalizeCompiledMs?: number
        vueFinalizeCodeMs?: number
        coreLoadMs?: number
        entryLoadMs?: number
        entryCodeReadMs?: number
        entrySidecarResolveMs?: number
        entryJsonReadMs?: number
        entryVueConfigMs?: number
        entryTemplateScanMs?: number
        entryScriptSetupMs?: number
        entryVueSignatureMs?: number
        entryAutoImportMs?: number
        entryPrepareMs?: number
        entryEmitOutputMs?: number
        entryStyleScanMs?: number
        entryStyleReadMs?: number
        entryResolveMs?: number
        entryChunkEmitMs?: number
        entryChunkLoadMs?: number
        entryChunkEmitFileMs?: number
        entryLayoutMs?: number
        requestGlobalsMs?: number
        weapiResolveMs?: number
        bundlerMs?: number
        renderStartMs?: number
        generateBundleMs?: number
        generateSharedMs?: number
        generateRewriteMs?: number
        generateModuleGraphMs?: number
        snapshotResolveMs?: number
        snapshotBuildMs?: number
        writeMs?: number
        watchToDirtyMs?: number
        emitMs?: number
        sharedChunkResolveMs?: number
        chunkEmitCount?: number
        loadCount?: number
        resolveCount?: number
        skippedLoadedCount?: number
        dirtyCount?: number
        pendingCount?: number
        emittedCount?: number
        dirtyReasonSummary?: string[]
        pendingReasonSummary?: string[]
      }>
      profile: {
        eventId?: string
        event?: ChangeEvent
        file?: string
        buildCoreMs?: number
        buildStartMs?: number
        pluginResolveMs?: number
        transformMs?: number
        coreTransformMs?: number
        wevuTransformMs?: number
        vueTransformMs?: number
        vueReadSourceMs?: number
        vueCompileMs?: number
        vueFinalizeCompiledMs?: number
        vueFinalizeCodeMs?: number
        coreLoadMs?: number
        entryLoadMs?: number
        entryCodeReadMs?: number
        entrySidecarResolveMs?: number
        entryJsonReadMs?: number
        entryVueConfigMs?: number
        entryTemplateScanMs?: number
        entryScriptSetupMs?: number
        entryVueSignatureMs?: number
        entryAutoImportMs?: number
        entryPrepareMs?: number
        entryEmitOutputMs?: number
        entryStyleScanMs?: number
        entryStyleReadMs?: number
        entryResolveMs?: number
        entryChunkEmitMs?: number
        entryChunkLoadMs?: number
        entryChunkEmitFileMs?: number
        entryLayoutMs?: number
        requestGlobalsMs?: number
        weapiResolveMs?: number
        bundlerMs?: number
        renderStartMs?: number
        generateBundleMs?: number
        generateSharedMs?: number
        generateRewriteMs?: number
        generateModuleGraphMs?: number
        snapshotResolveMs?: number
        snapshotBuildMs?: number
        writeMs?: number
        watchToDirtyMs?: number
        emitMs?: number
        sharedChunkResolveMs?: number
        chunkEmitCount?: number
        loadCount?: number
        resolveCount?: number
        skippedLoadedCount?: number
        dirtyCount?: number
        pendingCount?: number
        emittedCount?: number
        dirtyReasonSummary?: string[]
        pendingReasonSummary?: string[]
      }
    }
  }
  json: {
    cache: FileCache<any>
    emittedSource: Map<string, string>
  }
  asset: {
    emittedBuffer: Map<string, Buffer>
    scopedSlotGenerics: Map<string, Set<string>>
  }
  css: {
    importerToDependencies: Map<string, Set<string>>
    dependencyToImporters: Map<string, Set<string>>
    emittedSource: Map<string, string>
    sidecarImports: Set<string>
  }
  watcher: {
    rollupWatcherMap: Map<string, WatcherInstance>
    sidecarWatcherMap: Map<string, SidecarWatcher>
  }
  wxml: {
    depsMap: Map<string, Set<string>>
    importerMap: Map<string, Set<string>>
    depKindMap: Map<string, Map<string, Set<'template-import' | 'template-include' | 'script-module' | 'unknown'>>>
    tokenMap: Map<string, ScanWxmlResult>
    componentsMap: Map<string, ComponentsMap>
    aggregatedComponentsMap: Map<string, ComponentsMap>
    templatePathMap: Map<string, string>
    cache: FileCache<ScanWxmlResult>
    emittedCode: Map<string, string>
  }
  scan: {
    subPackageMap: Map<string, SubPackageMetaValue>
    independentSubPackageMap: Map<string, SubPackageMetaValue>
    warnedMessages: Set<string>
    appEntry?: AppEntry
    pluginJson?: PluginJson
    pluginJsonPath?: string
    isDirty: boolean
    independentDirtyRoots: Set<string>
  }
  lib: {
    enabled: boolean
    entries: Map<string, LibEntryState>
  }
  config: {
    packageInfo: PackageInfo
    defineEnv: Record<string, any>
    importMetaEnvDefineOverride?: Record<string, any>
    packageManager: DetectResult
    options: LoadConfigResult
  }
}

export function createRuntimeState(): RuntimeState {
  const emptyAutoRoutesSnapshot = createEmptyAutoRoutesSnapshot()
  const emptyAutoRoutesArtifacts = createAutoRoutesArtifacts(emptyAutoRoutesSnapshot)
  return {
    autoRoutes: {
      routes: emptyAutoRoutesSnapshot,
      serialized: emptyAutoRoutesArtifacts.serialized,
      moduleCode: emptyAutoRoutesArtifacts.moduleCode,
      typedDefinition: '',
      watchFiles: new Set<string>(),
      watchDirs: new Set<string>(),
      dirty: true,
      initialized: false,
      candidates: new Map<string, AutoRoutesCandidateState>(),
      needsFullRescan: true,
      loadingAppConfig: false,
    },
    autoImport: {
      registry: new Map<string, LocalAutoImportMatch>(),
      resolvedResolverComponents: new Map<string, string>(),
      matcherKey: '',
      preparedGlobsKey: undefined,
      version: 0,
      pendingEntriesByImporter: new Map<string, Set<string>>(),
    },
    build: {
      queue: new PQueue({ autoStart: false }),
      npmBuilt: false,
      independent: {
        outputs: new Map<string, RolldownOutput>(),
      },
      output: {
        emittedSource: new Map<string, string>(),
        wevuInternalRuntimeFileName: undefined,
        wevuInternalRuntimeFileNames: new Map<string, string>(),
      },
      hmr: {
        loadedEntrySet: new Set<string>(),
        dirtyEntrySet: new Set<string>(),
        dirtyEntryReasons: new Map<string, 'direct' | 'dependency' | 'metadata'>(),
        resolvedEntryMap: new Map<string, ResolvedId>(),
        externalComponentEntryMap: new Map<string, string>(),
        entriesMap: new Map<string, Entry | undefined>(),
        layoutEntryDependents: new Map<string, Set<string>>(),
        entryLayoutDependencies: new Map<string, Set<string>>(),
        vueEntryHasTemplate: new Map<string, boolean>(),
        vueEntryNonJsonSignatures: new Map<string, string>(),
        vueEntryScriptSignatures: new Map<string, string>(),
        vueEntryStyleIndependentSignatures: new Map<string, string>(),
        vueEntryTailwindContentSignatures: new Map<string, string>(),
        vueEntryTailwindTemplateContentSignatures: new Map<string, string>(),
        vueEntryTailwindScriptContentSignatures: new Map<string, string>(),
        appEntryAutoRoutesSignature: undefined,
        dirtyVueEntryIds: new Set<string>(),
        didEmitAllEntries: false,
        lastHmrEntryIds: new Set<string>(),
        lastEmittedEntryIds: new Set<string>(),
        lastEmittedChunkFileNames: new Set<string>(),
        sharedChunkSourceModuleIds: new Set<string>(),
        recentProfiles: [],
        profile: {},
      },
    },
    json: {
      cache: new FileCache<any>(),
      emittedSource: new Map<string, string>(),
    },
    asset: {
      emittedBuffer: new Map<string, Buffer>(),
      scopedSlotGenerics: new Map<string, Set<string>>(),
    },
    css: {
      importerToDependencies: new Map<string, Set<string>>(),
      dependencyToImporters: new Map<string, Set<string>>(),
      emittedSource: new Map<string, string>(),
      sidecarImports: new Set<string>(),
    },
    watcher: {
      rollupWatcherMap: new Map<string, WatcherInstance>(),
      sidecarWatcherMap: new Map<string, SidecarWatcher>(),
    },
    wxml: {
      depsMap: new Map<string, Set<string>>(),
      importerMap: new Map<string, Set<string>>(),
      depKindMap: new Map<string, Map<string, Set<'template-import' | 'template-include' | 'script-module' | 'unknown'>>>(),
      tokenMap: new Map<string, ScanWxmlResult>(),
      componentsMap: new Map<string, ComponentsMap>(),
      aggregatedComponentsMap: new Map<string, ComponentsMap>(),
      templatePathMap: new Map<string, string>(),
      cache: new FileCache<ScanWxmlResult>(),
      emittedCode: new Map<string, string>(),
    },
    scan: {
      subPackageMap: new Map<string, SubPackageMetaValue>(),
      independentSubPackageMap: new Map<string, SubPackageMetaValue>(),
      warnedMessages: new Set<string>(),
      isDirty: true,
      independentDirtyRoots: new Set<string>(),
      pluginJsonPath: undefined,
    },
    lib: {
      enabled: false,
      entries: new Map<string, LibEntryState>(),
    },
    config: {
      packageInfo: createDefaultPackageInfo(),
      defineEnv: {},
      importMetaEnvDefineOverride: undefined,
      packageManager: createDefaultPackageManager(),
      options: createDefaultLoadConfigResult(),
    },
  }
}
