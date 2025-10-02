import type { Plugin as PluginJson } from '@weapp-core/schematics'
import type { DetectResult } from 'package-manager-detector'
import type { AppEntry, ComponentsMap, SubPackageMetaValue } from '../types'
import type { ScanWxmlResult } from '../wxml'
import type { LocalAutoImportMatch } from './autoImport/types'
import type { LoadConfigResult, PackageInfo } from './config/types'
import type { WatcherInstance } from './watcher/types'
import process from 'node:process'
import PQueue from 'p-queue'
import { FileCache } from '../cache'
import { getOutputExtensions } from '../defaults'

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
    mpDistRoot: '',
    packageJsonPath: '',
    platform: 'weapp',
    srcRoot: '',
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
  autoImport: {
    registry: Map<string, LocalAutoImportMatch>
    matcher?: (input: string) => boolean
    matcherKey: string
  }
  build: {
    queue: PQueue
  }
  json: {
    cache: FileCache<any>
  }
  watcher: {
    rollupWatcherMap: Map<string, WatcherInstance>
  }
  wxml: {
    depsMap: Map<string, Set<string>>
    tokenMap: Map<string, ScanWxmlResult>
    componentsMap: Map<string, ComponentsMap>
  }
  scan: {
    subPackageMap: Map<string, SubPackageMetaValue>
    independentSubPackageMap: Map<string, SubPackageMetaValue>
    appEntry?: AppEntry
    pluginJson?: PluginJson
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
    autoImport: {
      registry: new Map<string, LocalAutoImportMatch>(),
      matcherKey: '',
    },
    build: {
      queue: new PQueue({ autoStart: false }),
    },
    json: {
      cache: new FileCache<any>(),
    },
    watcher: {
      rollupWatcherMap: new Map<string, WatcherInstance>(),
    },
    wxml: {
      depsMap: new Map<string, Set<string>>(),
      tokenMap: new Map<string, ScanWxmlResult>(),
      componentsMap: new Map<string, ComponentsMap>(),
    },
    scan: {
      subPackageMap: new Map<string, SubPackageMetaValue>(),
      independentSubPackageMap: new Map<string, SubPackageMetaValue>(),
    },
    config: {
      packageInfo: createDefaultPackageInfo(),
      defineEnv: {},
      packageManager: createDefaultPackageManager(),
      options: createDefaultLoadConfigResult(),
    },
  }
}
