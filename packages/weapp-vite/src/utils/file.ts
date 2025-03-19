import type { CopyGlobs, SubPackageMetaValue } from '@/types'

export function resolveGlobs(globs?: CopyGlobs, subPackageMeta?: SubPackageMetaValue | undefined): string[] {
  if (Array.isArray(globs)) {
    return globs
  }
  else if (typeof globs === 'function') {
    return globs(subPackageMeta)
  }
  return []
}
