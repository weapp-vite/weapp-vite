import type { PackageJson } from 'pkg-types'
import type { MpPlatform } from '../../types'
import { createRequire } from 'node:module'
import path from 'pathe'

export type TouchAppWxssOption = boolean | 'auto' | undefined

const tailwindPackageName = 'weapp-tailwindcss'

function hasTailwindcssDependency(packageJson: PackageJson) {
  return Boolean(
    packageJson.dependencies?.[tailwindPackageName]
    || packageJson.devDependencies?.[tailwindPackageName],
  )
}

export function resolveTouchAppWxssEnabled(options: {
  option?: TouchAppWxssOption
  platform: MpPlatform
  packageJson: PackageJson
  cwd: string
  resolve?: (id: string) => string
}): boolean {
  const resolvedOption = options.option ?? 'auto'
  if (resolvedOption === true) {
    return true
  }
  if (resolvedOption === false) {
    return false
  }
  if (options.platform !== 'weapp') {
    return false
  }
  if (hasTailwindcssDependency(options.packageJson)) {
    return true
  }
  const resolve = options.resolve
    ?? createRequire(path.join(options.cwd, 'package.json')).resolve
  try {
    resolve(tailwindPackageName)
    return true
  }
  catch {
    return false
  }
}
