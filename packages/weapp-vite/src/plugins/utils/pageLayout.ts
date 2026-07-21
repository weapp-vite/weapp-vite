import type { CompilerContext } from '../../context'
import type { ResolvedPageLayout } from '../vue/transform/pageLayout/types'
import { isTemplate } from '../../utils'
import { collectNativeLayoutAssets } from '../vue/transform/pageLayout'

export async function expandResolvedPageLayoutFiles(
  layouts: ResolvedPageLayout[],
) {
  const files: string[] = []

  for (const layout of layouts) {
    if (layout.kind !== 'native') {
      files.push(layout.file)
      continue
    }

    const nativeAssets = await collectNativeLayoutAssets(layout.file)
    for (const asset of Object.values(nativeAssets)) {
      if (asset) {
        files.push(asset)
      }
    }
  }

  return files
}

export async function registerResolvedPageLayoutDependencies(
  ctx: CompilerContext,
  ownerId: string,
  layouts: ResolvedPageLayout[],
) {
  const dependencies = await expandResolvedPageLayoutFiles(layouts)
  const transitiveDependencies = new Set(dependencies)
  for (const file of dependencies) {
    if (!isTemplate(file)) {
      continue
    }
    await ctx.wxmlService?.scan(file)
    for (const dependency of ctx.wxmlService?.depsMap.get(file) ?? []) {
      transitiveDependencies.add(dependency)
    }
  }
  ctx.moduleGraphService.replaceEntryDependencies(
    ownerId,
    'layout',
    transitiveDependencies,
  )
}
