import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../../../context'
import type { NpmService } from './types'
import { createOxcRuntimeSupport } from '../../oxcRuntime'
import { createPackageBuilder } from '../builder'
import { createDependenciesCache } from '../cache'
import { getPackNpmRelationList } from '../relations'
import { createNpmBuildService } from './build'

export {
  hasLocalSubPackageNpmConfig,
  resolveNpmBuildCandidateDependenciesSync,
  resolveNpmBuildCandidateDependencyRecordSync,
  resolveNpmDistDirName,
  resolveTargetDependencies,
} from './dependencies'

export {
  resolveCopyFilterRelativePath,
  resolveNpmSourceCacheOutDir,
} from './paths'

export type { NpmService } from './types'

export function createNpmService(ctx: MutableCompilerContext): NpmService {
  const oxcRuntimeSupport = createOxcRuntimeSupport()
  const oxcVitePlugin = oxcRuntimeSupport.vitePlugin
  const cache = createDependenciesCache(ctx)
  const builder = createPackageBuilder(ctx, oxcVitePlugin as Plugin | undefined)
  const buildService = createNpmBuildService({
    ctx,
    builder,
    cache,
  })

  return {
    getDependenciesCacheFilePath: cache.getDependenciesCacheFilePath,
    get dependenciesCacheHash() {
      return cache.dependenciesCacheHash()
    },
    isMiniprogramPackage: builder.isMiniprogramPackage,
    shouldSkipBuild: builder.shouldSkipBuild,
    writeDependenciesCache: cache.writeDependenciesCache,
    readDependenciesCache: cache.readDependenciesCache,
    checkDependenciesCacheOutdate: cache.checkDependenciesCacheOutdate,
    bundleBuild: builder.bundleBuild,
    copyBuild: builder.copyBuild,
    buildPackage: builder.buildPackage,
    getPackNpmRelationList: () => getPackNpmRelationList(ctx),
    build: buildService.build,
  }
}
