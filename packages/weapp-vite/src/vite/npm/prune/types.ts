import type { PreparedNpmOutput } from '../output'

export interface NpmFile {
  fileName: string
  source: string | Uint8Array
}

export interface NpmPackage {
  root: string
  base: string
  boundary: string
  name: string
  files: Map<string, NpmFile>
}

export interface PackageInfo {
  root: string
  base: string
  boundary: string
  name: string
  relative: string
}

export interface ReferenceTarget {
  root: string
  relative: string
}

export interface ReferenceSet {
  seeds: Set<string>
  edges: Map<string, ReferenceTarget[]>
  fallback?: string
}

export interface ReferenceGraph {
  packages: Map<string, ReferenceSet>
  fallbackBases: Map<string, string>
}

export interface NpmOutputWithLogicalRoots extends PreparedNpmOutput {}
