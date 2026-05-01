import type { PackageFileEntry } from './analyze'
import type { BuildOrigin, ModuleSourceType, PackageType } from './base'

export interface TreemapNodeMetaBase {
  kind: 'package' | 'file' | 'module' | 'asset'
  nodeId: string
  bytes?: number
  totalBytes?: number
  packageId: string
  packageLabel: string
}

export interface TreemapPackageNodeMeta extends TreemapNodeMetaBase {
  kind: 'package'
  packageType: PackageType
  fileCount: number
}

export interface TreemapFileNodeMeta extends TreemapNodeMetaBase {
  kind: 'file'
  fileName: string
  from: BuildOrigin
  childCount: number
  type: PackageFileEntry['type']
}

export interface TreemapModuleNodeMeta extends TreemapNodeMetaBase {
  kind: 'module'
  fileName: string
  source: string
  sourceType: ModuleSourceType
  originalBytes?: number
  packageCount: number
}

export interface TreemapAssetNodeMeta extends TreemapNodeMetaBase {
  kind: 'asset'
  fileName: string
  source: string
}

export type TreemapNodeMeta
  = | TreemapPackageNodeMeta
    | TreemapFileNodeMeta
    | TreemapModuleNodeMeta
    | TreemapAssetNodeMeta

export interface TreemapNode {
  id: string
  name: string
  value: number
  meta: TreemapNodeMeta
  children?: TreemapNode[]
  itemStyle?: Record<string, unknown>
  label?: Record<string, unknown>
  upperLabel?: Record<string, unknown>
}
