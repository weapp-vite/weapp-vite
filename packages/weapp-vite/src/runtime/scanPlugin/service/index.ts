import type { App as AppJson, Plugin as PluginJson } from '@weapp-core/schematics'
import type { MutableCompilerContext } from '../../../context'
import type {
  AppEntry,
  StyleEntry,
  SubPackageMetaValue,
} from '../../../types'
import { loadAppEntry } from './app'
import { drainIndependentDirtyRoots, isMainPackageFileName, markIndependentDirty } from './shared'
import { loadSubPackages } from './subPackages'

export {
  resolveScanAppBasename,
  resolveScanAppPreludeBasename,
  resolveScanJsonEntryBasename,
  resolveScanPluginBasename,
} from './app'

export interface ScanService {
  appEntry?: AppEntry
  pluginJson?: PluginJson
  pluginJsonPath?: string
  readonly mainPackageStyleEntries: StyleEntry[] | undefined
  subPackageMap: Map<string, SubPackageMetaValue>
  independentSubPackageMap: Map<string, SubPackageMetaValue>
  loadAppEntry: () => Promise<AppEntry>
  loadSubPackages: () => SubPackageMetaValue[]
  isMainPackageFileName: (fileName: string) => boolean
  readonly workersOptions: AppJson['workers'] | undefined
  readonly workersDir: string | undefined
  markDirty: () => void
  markIndependentDirty: (root: string) => void
  drainIndependentDirtyRoots: () => string[]
}

export function createScanService(ctx: MutableCompilerContext): ScanService {
  const scanState = ctx.runtimeState.scan
  const { subPackageMap, independentSubPackageMap, independentDirtyRoots } = scanState

  return {
    get appEntry() {
      return scanState.appEntry
    },
    set appEntry(value: AppEntry | undefined) {
      scanState.appEntry = value
    },
    get pluginJson() {
      return scanState.pluginJson
    },
    set pluginJson(value: PluginJson | undefined) {
      scanState.pluginJson = value
    },
    get pluginJsonPath() {
      return scanState.pluginJsonPath
    },
    set pluginJsonPath(value: string | undefined) {
      scanState.pluginJsonPath = value
    },
    get mainPackageStyleEntries() {
      return scanState.mainPackageStyleEntries
    },
    subPackageMap,
    independentSubPackageMap,
    async loadAppEntry() {
      return await loadAppEntry(ctx, scanState)
    },
    loadSubPackages() {
      return loadSubPackages(ctx)
    },
    isMainPackageFileName(fileName: string) {
      return isMainPackageFileName(fileName, independentSubPackageMap)
    },
    get workersOptions() {
      return scanState.appEntry?.json?.workers
    },
    get workersDir() {
      const workersOptions = scanState.appEntry?.json?.workers
      return typeof workersOptions === 'object' ? workersOptions?.path : workersOptions
    },
    markDirty() {
      scanState.isDirty = true
      scanState.appEntry = undefined
      scanState.mainPackageStyleEntries = undefined
      scanState.pluginJson = undefined
      scanState.pluginJsonPath = undefined
    },
    markIndependentDirty(root: string) {
      markIndependentDirty(root, independentSubPackageMap, independentDirtyRoots)
    },
    drainIndependentDirtyRoots() {
      return drainIndependentDirtyRoots(independentDirtyRoots)
    },
  }
}
