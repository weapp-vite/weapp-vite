import { getPackageInfo } from 'local-pkg'
import { packageSearchOptions } from '../packageResolution'

/** 保持分包从候选依赖产物中提取完整依赖闭包的既有语义。 */
export async function resolvePackageDependencyClosure(
  dependencies: string[],
  cwd?: string,
  resolvePackageInfo: (dep: string, cwd?: string) => Promise<Awaited<ReturnType<typeof getPackageInfo>> | null> = async (dep, cwd) => {
    try {
      return await getPackageInfo(dep, packageSearchOptions(cwd))
    }
    catch {
      return null
    }
  },
) {
  const visited = new Set<string>()
  const names = new Set<string>()

  async function visit(dep: string, resolveFrom?: string) {
    const packageInfo = await resolvePackageInfo(dep, resolveFrom)
    const identity = `${packageInfo?.rootPath ?? resolveFrom ?? ''}\0${dep}`
    if (visited.has(identity)) {
      return
    }
    visited.add(identity)
    names.add(dep)

    const transitiveDependencies = Object.keys(packageInfo?.packageJson.dependencies ?? {})
    await Promise.all(transitiveDependencies.map(childDep => visit(childDep, packageInfo?.rootPath ?? resolveFrom)))
  }

  await Promise.all(dependencies.map(dep => visit(dep, cwd)))
  return [...names]
}
