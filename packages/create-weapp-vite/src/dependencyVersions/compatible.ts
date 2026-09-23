// eslint-disable-next-line e18e/ban-dependencies -- 与 npm 的 caret 和预发布兼容规则保持一致。
import { gte, prerelease, rcompare, satisfies, valid } from 'semver'

export interface PackageVersionCandidates {
  version: string
  versions: string[]
}

/** 仅选择所有已使用核心包共同发布、且兼容各自基线的最高稳定版本。 */
export function findCompatibleVersion(packages: PackageVersionCandidates[]): string | undefined {
  if (packages.length === 0 || packages.some(pkg => !valid(pkg.version) || prerelease(pkg.version))) {
    return undefined
  }
  return packages[0]!.versions
    .filter(version => valid(version) && !prerelease(version))
    .filter(version => packages.every(pkg =>
      pkg.versions.includes(version)
      && gte(version, pkg.version)
      && satisfies(version, `^${pkg.version}`),
    ))
    .sort(rcompare)[0]
}
