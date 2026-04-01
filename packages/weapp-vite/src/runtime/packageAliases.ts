import { existsSync } from 'node:fs'
import { getPackageInfoSync } from 'local-pkg'
import path from 'pathe'

export interface BuiltinPackageAliasEntry {
  find: string
  replacement: string
}

interface SpecialPackageAlias {
  packageName: string
  distEntry: string
}

interface SpecifierAlias {
  find: string
  replacement: string
}

const SPECIAL_PACKAGE_ALIASES: SpecialPackageAlias[] = [
  {
    packageName: 'class-variance-authority',
    distEntry: 'dist/index.js',
  },
]

const SPECIFIER_ALIASES: SpecifierAlias[] = [
  {
    find: 'vue-demi',
    replacement: 'wevu/vue-demi',
  },
]

export function resolveBuiltinPackageAliases(): BuiltinPackageAliasEntry[] {
  const aliases: BuiltinPackageAliasEntry[] = []

  for (const { packageName, distEntry } of SPECIAL_PACKAGE_ALIASES) {
    const info = getPackageInfoSync(packageName)
    if (!info) {
      continue
    }
    const resolvedEntry = path.resolve(info.rootPath, distEntry)
    if (!existsSync(resolvedEntry)) {
      continue
    }
    aliases.push({
      find: packageName,
      replacement: resolvedEntry,
    })
  }

  aliases.push(...SPECIFIER_ALIASES)

  return aliases
}
