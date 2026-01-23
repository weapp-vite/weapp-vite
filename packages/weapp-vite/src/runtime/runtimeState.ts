import type { Plugin as PluginJson } from '@weapp-core/schematics'
import type { DetectResult } from 'package-manager-detector'
import type { RolldownOutput } from 'rolldown'
import type { AppEntry, ComponentsMap, SubPackageMetaValue } from '../types'
import type { AutoRoutes } from '../types/routes'
import type { ScanWxmlResult } from '../wxml'
import type { LocalAutoImportMatch } from './autoImport/types'
import type { LoadConfigResult, PackageInfo } from './config/types'
import type { SidecarWatcher, WatcherInstance } from './watcher/types'
import process from 'node:process'
import PQueue from 'p-queue'
import { FileCache } from '../cache'
import { getOutputExtensions } from '../defaults'

interface AutoRoutesCandidateState {
  base: string
  files: Set<string>
  hasScript: boolean
  hasTemplate: boolean
  jsonPath?: string
}

function createDefaultLoadConfigResult(): LoadConfigResult {
  return {
    config: {},
    aliasEntries: [],
    outputExtensions: getOutputExtensions('weapp'),
    packageJson: {},
    relativeSrcRoot: p => p,
    cwd: process.cwd(),
    isDev: false,
    mode: 'development',
    projectConfig: {},
    projectConfigPath: undefined,
    projectPrivateConfigPath: undefined,
    mpDistRoot: '',
    packageJsonPath: '',
    platform: 'weapp',
    srcRoot: '',
    configFilePath: undefined,
    weappWeb: undefined,
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
  }
  autoImport: {
    registry: Map<string, LocalAutoImportMatch>
    matcher?: (input: string) => boolean
    matcherKey: string
  }
  build: {
    queue: PQueue
    npmBuilt: boolean
    independent: {
      outputs: Map<string, RolldownOutput>
    }
  }
  json: {
    cache: FileCache<any>
  }
  css: {
    importerToDependencies: Map<string, Set<string>>
    dependencyToImporters: Map<string, Set<string>>
  }
  watcher: {
    rollupWatcherMap: Map<string, WatcherInstance>
    sidecarWatcherMap: Map<string, SidecarWatcher>
  }
  wxml: {
    depsMap: Map<string, Set<string>>
    tokenMap: Map<string, ScanWxmlResult>
    componentsMap: Map<string, ComponentsMap>
    cache: FileCache<ScanWxmlResult>
    emittedCode: Map<string, string>
  }
  scan: {
    subPackageMap: Map<string, SubPackageMetaValue>
    independentSubPackageMap: Map<string, SubPackageMetaValue>
    appEntry?: AppEntry
    pluginJson?: PluginJson
    pluginJsonPath?: string
    isDirty: boolean
    independentDirtyRoots: Set<string>
  }
  config: {
    packageInfo: PackageInfo
    defineEnv: Record<string, any>
    packageManager: DetectResult
    options: LoadConfigResult
  }
}

export function createRuntimeState(): RuntimeState {
  return {
    autoRoutes: {
      routes: {
        pages: [],
        entries: [],
        subPackages: [],
      },
      serialized: JSON.stringify({
        pages: [],
        entries: [],
        subPackages: [],
      }),
      moduleCode: [
        'const routes = {',
        '  pages: [],',
        '  entries: [],',
        '  subPackages: [],',
        '};',
        'const pages = routes.pages;',
        'const entries = routes.entries;',
        'const subPackages = routes.subPackages;',
        'export { routes, pages, entries, subPackages };',
        'export default routes;',
      ].join('\n'),
      typedDefinition: '',
      watchFiles: new Set<string>(),
      watchDirs: new Set<string>(),
      dirty: true,
      initialized: false,
      candidates: new Map<string, AutoRoutesCandidateState>(),
      needsFullRescan: true,
    },
    autoImport: {
      registry: new Map<string, LocalAutoImportMatch>(),
      matcherKey: '',
    },
    build: {
      queue: new PQueue({ autoStart: false }),
      npmBuilt: false,
      independent: {
        outputs: new Map<string, RolldownOutput>(),
      },
    },
    json: {
      cache: new FileCache<any>(),
    },
    css: {
      importerToDependencies: new Map<string, Set<string>>(),
      dependencyToImporters: new Map<string, Set<string>>(),
    },
    watcher: {
      rollupWatcherMap: new Map<string, WatcherInstance>(),
      sidecarWatcherMap: new Map<string, SidecarWatcher>(),
    },
    wxml: {
      depsMap: new Map<string, Set<string>>(),
      tokenMap: new Map<string, ScanWxmlResult>(),
      componentsMap: new Map<string, ComponentsMap>(),
      cache: new FileCache<ScanWxmlResult>(),
      emittedCode: new Map<string, string>(),
    },
    scan: {
      subPackageMap: new Map<string, SubPackageMetaValue>(),
      independentSubPackageMap: new Map<string, SubPackageMetaValue>(),
      isDirty: true,
      independentDirtyRoots: new Set<string>(),
      pluginJsonPath: undefined,
    },
    config: {
      packageInfo: createDefaultPackageInfo(),
      defineEnv: {},
      packageManager: createDefaultPackageManager(),
      options: createDefaultLoadConfigResult(),
    },
  }
}
