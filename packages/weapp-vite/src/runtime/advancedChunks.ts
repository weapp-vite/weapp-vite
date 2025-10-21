import type { ResolveSharedChunkNameOptions } from './chunkStrategy'
import { resolveSharedChunkName } from './chunkStrategy'

export type AdvancedChunkNameResolver = (
  id: string,
  ctx: ResolveSharedChunkNameOptions['ctx'],
) => string | undefined

function testByReg2DExpList(reg2DExpList: RegExp[][]) {
  return (id: string) =>
    reg2DExpList.some(regExpList => regExpList.some((regExp) => {
      regExp.lastIndex = 0
      return regExp.test(id)
    }))
}

export interface AdvancedChunkResolverOptions {
  relativeAbsoluteSrcRoot: ResolveSharedChunkNameOptions['relativeAbsoluteSrcRoot']
  getSubPackageRoots: () => ResolveSharedChunkNameOptions['subPackageRoots']
  strategy: ResolveSharedChunkNameOptions['strategy']
  vendorsMatchers: RegExp[][]
}

export function createAdvancedChunkNameResolver(options: AdvancedChunkResolverOptions): AdvancedChunkNameResolver {
  const {
    relativeAbsoluteSrcRoot,
    getSubPackageRoots,
    strategy,
    vendorsMatchers,
  } = options

  const isVendor = testByReg2DExpList(vendorsMatchers)

  return (id, ctx) => {
    const subPackageRoots = Array.from(getSubPackageRoots())
    const sharedName = resolveSharedChunkName({
      id,
      ctx,
      relativeAbsoluteSrcRoot,
      subPackageRoots,
      strategy,
    })

    if (!isVendor(id)) {
      return sharedName
    }

    if (strategy === 'hoist') {
      return 'vendors'
    }

    return sharedName
  }
}
