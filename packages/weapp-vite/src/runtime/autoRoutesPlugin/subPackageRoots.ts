import type { MutableCompilerContext } from '../../context'

interface AppJsonLikeSubPackage {
  root?: string
}

function collectAppJsonSubPackageRoots(ctx: Pick<MutableCompilerContext, 'runtimeState'>) {
  const appJson = ctx.runtimeState.scan?.appEntry?.json as {
    subPackages?: AppJsonLikeSubPackage[]
    subpackages?: AppJsonLikeSubPackage[]
  } | undefined

  return [
    ...appJson?.subPackages ?? [],
    ...appJson?.subpackages ?? [],
  ].map(item => item.root).filter((root): root is string => Boolean(root))
}

export function getAutoRoutesSubPackageRoots(
  ctx: Pick<MutableCompilerContext, 'configService' | 'runtimeState'>,
) {
  const roots = new Set<string>(Object.keys(ctx.configService?.weappViteConfig?.subPackages ?? {}))

  for (const root of collectAppJsonSubPackageRoots(ctx)) {
    roots.add(root)
  }

  return [...roots]
}
