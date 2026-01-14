import type { SubPackageMetaValue } from '../../types'

export type PackageType = 'main' | 'subPackage' | 'independent' | 'virtual'
export type ModuleSourceType = 'src' | 'plugin' | 'node_modules' | 'workspace'
export type BuildOrigin = 'main' | 'independent'

export interface ModuleInFile {
  id: string
  source: string
  sourceType: ModuleSourceType
  bytes?: number
  originalBytes?: number
}

export interface PackageFileEntry {
  file: string
  type: 'chunk' | 'asset'
  from: BuildOrigin
  size?: number
  isEntry?: boolean
  modules?: ModuleInFile[]
  source?: string
}

export interface PackageReport {
  id: string
  label: string
  type: PackageType
  files: PackageFileEntry[]
}

export interface ModuleUsage {
  id: string
  source: string
  sourceType: ModuleSourceType
  packages: Array<{ packageId: string, files: string[] }>
}

export interface SubPackageDescriptor {
  root: string
  independent: boolean
  name?: string
}

export interface AnalyzeSubpackagesResult {
  packages: PackageReport[]
  modules: ModuleUsage[]
  subPackages: SubPackageDescriptor[]
}

export interface PackageAccumulator {
  id: string
  label: string
  type: PackageType
  files: Map<string, PackageFileEntry>
}

export interface ModuleAccumulator {
  id: string
  source: string
  sourceType: ModuleSourceType
  packages: Map<string, Set<string>>
}

export interface PackageClassifierContext {
  subPackageRoots: Set<string>
  independentRoots: Set<string>
}

export interface ClassifiedPackage {
  id: string
  label: string
  type: PackageType
}

export type SubPackageMetas = SubPackageMetaValue[]
