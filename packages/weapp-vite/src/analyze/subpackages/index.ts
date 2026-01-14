import type { RolldownOutput } from 'rolldown'
import type { CompilerContext } from '../../context'
import type { AnalyzeSubpackagesResult, ModuleAccumulator, PackageAccumulator, PackageClassifierContext } from './types'
import { build } from 'vite'
import { createSharedBuildConfig } from '../../runtime/sharedBuildConfig'
import { processOutput } from './output'
import { expandVirtualModulePlacements, summarizeModules, summarizePackages, summarizeSubPackages } from './summary'

export type {
  AnalyzeSubpackagesResult,
  ModuleInFile,
  ModuleUsage,
  PackageFileEntry,
  PackageReport,
  SubPackageDescriptor,
} from './types'

export async function analyzeSubpackages(ctx: CompilerContext): Promise<AnalyzeSubpackagesResult> {
  const { configService, scanService, buildService } = ctx

  if (!configService || !scanService || !buildService) {
    throw new Error('analyzeSubpackages requires configService, scanService and buildService to be initialized')
  }

  await scanService.loadAppEntry()
  const subPackageMetas = scanService.loadSubPackages()

  const subPackageRoots = new Set<string>()
  const independentRoots = new Set<string>()

  for (const meta of subPackageMetas) {
    const root = meta.subPackage.root
    if (root) {
      subPackageRoots.add(root)
      if (meta.subPackage.independent) {
        independentRoots.add(root)
      }
    }
  }

  const classifierContext: PackageClassifierContext = {
    subPackageRoots,
    independentRoots,
  }

  const analysisConfig = configService.merge(
    undefined,
    createSharedBuildConfig(configService, scanService),
    {
      build: {
        write: false,
        watch: null,
      },
    },
  )

  const mainResult = await build(analysisConfig)
  const mainOutputs = Array.isArray(mainResult) ? mainResult : [mainResult]

  const packages = new Map<string, PackageAccumulator>()
  const modules = new Map<string, ModuleAccumulator>()

  for (const output of mainOutputs) {
    processOutput(output as RolldownOutput, 'main', ctx, classifierContext, packages, modules)
  }

  for (const root of independentRoots) {
    const output = buildService.getIndependentOutput(root)
    processOutput(output, 'independent', ctx, classifierContext, packages, modules)
  }

  expandVirtualModulePlacements(modules, packages, classifierContext)

  return {
    packages: summarizePackages(packages),
    modules: summarizeModules(modules),
    subPackages: summarizeSubPackages(subPackageMetas),
  }
}
