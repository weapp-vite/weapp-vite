import type { PackageJson } from 'pkg-types'
import type { InputOption } from 'rolldown'
import type { MutableCompilerContext } from '../../../context'
import type { NpmBuildOptions } from '../../../types'

export interface NpmService {
  getDependenciesCacheFilePath: (key?: string) => string
  readonly dependenciesCacheHash: string
  isMiniprogramPackage: (pkg: PackageJson) => boolean
  shouldSkipBuild: (outDir: string, isOutdated: boolean) => Promise<boolean>
  writeDependenciesCache: (root?: string) => Promise<void>
  readDependenciesCache: (root?: string) => Promise<any>
  checkDependenciesCacheOutdate: (root?: string) => Promise<boolean>
  bundleBuild: (args: { entry: InputOption, name: string, options?: NpmBuildOptions, outDir: string }) => Promise<void>
  copyBuild: (args: { from: string, to: string, name: string }) => Promise<void>
  buildPackage: (args: { dep: string, outDir: string, options?: NpmBuildOptions, isDependenciesCacheOutdate: boolean }) => Promise<void>
  getPackNpmRelationList: () => { packageJsonPath: string, miniprogramNpmDistDir: string }[]
  build: (options?: NpmBuildOptions) => Promise<void>
}

export interface NpmBuildServiceOptions {
  ctx: MutableCompilerContext
  builder: {
    isMiniprogramPackage: (pkg: PackageJson) => boolean
    buildPackage: (args: { dep: string, outDir: string, options?: NpmBuildOptions, isDependenciesCacheOutdate: boolean }) => Promise<void>
  }
  cache: {
    checkDependenciesCacheOutdate: (root?: string) => Promise<boolean>
    writeDependenciesCache: (root?: string) => Promise<void>
  }
}
