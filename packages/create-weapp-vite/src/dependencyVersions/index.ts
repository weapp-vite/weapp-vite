import type { PackageJson } from 'pkg-types'
import logger from '@weapp-core/logger'
// eslint-disable-next-line e18e/ban-dependencies -- 与 npm 的 caret 和预发布兼容规则保持一致。
import { prerelease, valid } from 'semver'
import { version as reactVersion } from '../../../../packages-runtime/react/package.json'
import { version as wevuVersion } from '../../../../packages-runtime/wevu/package.json'
import { version as dashboardVersion } from '../../../dashboard/package.json'
import { version as eslintVersion } from '../../../eslint/package.json'
import { version as weappViteVersion } from '../../../weapp-vite/package.json'
import { getPackageVersionsFromNpm } from '../npm'
import { findCompatibleVersion } from './compatible'

export type DependencyVersionStrategy = 'compatible' | 'bundled'

const BUNDLED_VERSIONS = {
  'weapp-vite': weappViteVersion,
  'wevu': wevuVersion,
  '@weapp-vite/dashboard': dashboardVersion,
  '@weapp-vite/react': reactVersion,
  '@weapp-vite/eslint': eslintVersion,
}
const CORE_PACKAGES = ['weapp-vite', 'wevu', '@weapp-vite/dashboard'] as const
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const
const GROUP_TIMEOUT_MS = 5_000

/** 校验依赖版本策略，避免无效选项在创建文件后才报错。 */
export function validateDependencyVersionStrategy(value: unknown): asserts value is DependencyVersionStrategy {
  if (value !== 'compatible' && value !== 'bundled') {
    throw new Error(`无效的依赖版本策略：${String(value)}，仅支持 compatible 或 bundled`)
  }
}

function hasDependency(pkg: PackageJson, name: string) {
  return DEPENDENCY_FIELDS.some(field => pkg[field]?.[name] !== undefined)
}

function setDependencyVersion(pkg: PackageJson, name: string, version: string) {
  for (const field of DEPENDENCY_FIELDS) {
    if (pkg[field]?.[name] !== undefined) {
      pkg[field][name] = `^${version}`
    }
  }
}

/** 根据模板实际使用的核心依赖解析兼容版本，失败时保留随包发布的完整组合。 */
export async function resolveDependencyVersions(
  pkg: PackageJson,
  strategy: DependencyVersionStrategy = 'compatible',
): Promise<void> {
  validateDependencyVersionStrategy(strategy)
  for (const [name, version] of Object.entries(BUNDLED_VERSIONS)) {
    setDependencyVersion(pkg, name, version)
  }

  const names = CORE_PACKAGES.filter(name => hasDependency(pkg, name))
  if (strategy === 'bundled' || names.length === 0) {
    return
  }

  const bundledDescription = names.map(name => `${name}@${BUNDLED_VERSIONS[name]}`).join('、')
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    if (names.some(name => !valid(BUNDLED_VERSIONS[name]) || prerelease(BUNDLED_VERSIONS[name]))) {
      throw new Error('预发布基线保持随包版本，不自动更新')
    }
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        const error = new Error('官方 npm 版本查询超过 5 秒')
        controller.abort(error)
        reject(error)
      }, GROUP_TIMEOUT_MS)
    })
    const candidates = await Promise.race([
      Promise.all(names.map(async name => ({
        version: BUNDLED_VERSIONS[name],
        versions: await getPackageVersionsFromNpm(name, controller.signal),
      }))),
      deadline,
    ])
    const version = findCompatibleVersion(candidates)
    if (!version) {
      throw new Error('未找到核心依赖共同发布的兼容稳定版本')
    }
    for (const name of names) {
      setDependencyVersion(pkg, name, version)
    }
  }
  catch (error) {
    controller.abort(error)
    const reason = error instanceof Error ? error.message : String(error)
    logger.warn(`未能更新官方 npm 兼容版本（${reason}），已使用随包版本：${bundledDescription}`)
  }
  finally {
    clearTimeout(timer)
  }
}
