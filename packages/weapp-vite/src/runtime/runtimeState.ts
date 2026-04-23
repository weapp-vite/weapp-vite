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
    version: number
    pendingEntriesByImporter: Map<string, Set<string>>
  }
  build: {
    queue: PQueue
    npmBuilt: boolean
    independent: {
      outputs: Map<string, RolldownOutput>
    }
    hmr: {
      loadedEntrySet: Set<string>
      dirtyEntrySet: Set<string>
      dirtyEntryReasons: Map<string, 'direct' | 'dependency'>
      resolvedEntryMap: Map<string, ResolvedId>
      entriesMap: Map<string, Entry | undefined>
      layoutEntryDependents: Map<string, Set<string>>
      entryLayoutDependencies: Map<string, Set<string>>
      recentProfiles: Array<{
        totalMs: number
        watchToDirtyMs?: number
        emitMs?: number
        sharedChunkResolveMs?: number
        dirtyCount?: number
        pendingCount?: number
        emittedCount?: number
      }>
      profile: {
        event?: ChangeEvent
        file?: string
        watchToDirtyMs?: number
        emitMs?: number
        sharedChunkResolveMs?: number
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
  }
  css: {
    importerToDependencies: Map<string, Set<string>>
    dependencyToImporters: Map<string, Set<string>>
    emittedSource: Map<string, string>
  }
  watcher: {
    rollupWatcherMap: Map<string, WatcherInstance>
    sidecarWatcherMap: Map<string, SidecarWatcher>
  }
  wxml: {
    depsMap: Map<string, Set<string>>
    importerMap: Map<string, Set<string>>
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
      version: 0,
      pendingEntriesByImporter: new Map<string, Set<string>>(),
    },
    build: {
      queue: new PQueue({ autoStart: false }),
      npmBuilt: false,
      independent: {
        outputs: new Map<string, RolldownOutput>(),
      },
      hmr: {
        loadedEntrySet: new Set<string>(),
        dirtyEntrySet: new Set<string>(),
        dirtyEntryReasons: new Map<string, 'direct' | 'dependency'>(),
        resolvedEntryMap: new Map<string, ResolvedId>(),
        entriesMap: new Map<string, Entry | undefined>(),
        layoutEntryDependents: new Map<string, Set<string>>(),
        entryLayoutDependencies: new Map<string, Set<string>>(),
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
    },
    css: {
      importerToDependencies: new Map<string, Set<string>>(),
      dependencyToImporters: new Map<string, Set<string>>(),
      emittedSource: new Map<string, string>(),
    },
    watcher: {
      rollupWatcherMap: new Map<string, WatcherInstance>(),
      sidecarWatcherMap: new Map<string, SidecarWatcher>(),
    },
    wxml: {
      depsMap: new Map<string, Set<string>>(),
      importerMap: new Map<string, Set<string>>(),
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
