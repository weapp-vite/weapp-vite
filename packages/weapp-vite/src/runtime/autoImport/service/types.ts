import type { ResolvedValue } from '../../../auto-import-components/resolvers'
import type { SubPackageMetaValue } from '../../../types'
import type {
  getHtmlCustomDataSettings,
  getTypedComponentsSettings,
  getVueComponentsSettings,
} from '../config'
import type { LocalAutoImportMatch } from '../types'

export type { LocalAutoImportMatch } from '../types'

export interface ResolverAutoImportMatch {
  kind: 'resolver'
  value: ResolvedValue
}

export type AutoImportMatch = LocalAutoImportMatch | ResolverAutoImportMatch

export interface AutoImportService {
  reset: () => void
  getVersion: () => number
  runInBatch: <T>(task: () => T | Promise<T>) => Promise<T>
  registerPotentialComponent: (filePath: string) => Promise<void>
  removePotentialComponent: (filePath: string) => void
  resolve: (componentName: string, importerBaseName?: string) => AutoImportMatch | undefined
  setSupportFileResolverComponents: (components: Record<string, string>) => void
  clearSupportFileResolverComponents: () => void
  collectStaticResolverComponentsForSupportFiles: () => Record<string, string>
  filter: (id: string, meta?: SubPackageMetaValue) => boolean
  getRegisteredLocalComponents: () => LocalAutoImportMatch[]
  awaitPendingRegistrations?: () => Promise<void>
  awaitManifestWrites: () => Promise<void>
}

export interface AutoImportOutputSettingsSnapshot {
  typed: ReturnType<typeof getTypedComponentsSettings>
  html: ReturnType<typeof getHtmlCustomDataSettings>
  vue: ReturnType<typeof getVueComponentsSettings>
}
