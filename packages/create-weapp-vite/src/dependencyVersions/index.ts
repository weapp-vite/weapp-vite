import type { PackageJson } from 'pkg-types'
import type { RegistryOptions } from '../npm'
import logger from '@weapp-core/logger'
// eslint-disable-next-line e18e/ban-dependencies -- 与 npm 的 caret 和预发布兼容规则保持一致。
import { minVersion, prerelease, satisfies, valid } from 'semver'
import { version as reactVersion } from '../../../../packages-runtime/react/package.json'
import { version as wevuVersion } from '../../../../packages-runtime/wevu/package.json'
import { version as dashboardVersion } from '../../../dashboard/package.json'
import { version as eslintVersion } from '../../../eslint/package.json'
import { version as weappViteVersion } from '../../../weapp-vite/package.json'
import { displayRegistry, getPackageVersionsFromNpm, publicRegistryOptions, resolveRegistryOptions } from '../npm'
import { findCompatibleVersion } from './compatible'
import { queryWithDeadline } from './deadline'

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
const PRIMARY_TIMEOUT_MS = 4_000
const FALLBACK_TIMEOUT_MS = 1_000
const PUBLIC_REGISTRIES = ['https://registry.npmjs.org/', 'https://registry.npmmirror.com/']

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

interface ResolutionResult {
  strategy: DependencyVersionStrategy
}

/** 备用源仅用于恢复提示，不能把备用源中的新版写进当前安装源的项目。 */
async function suggestFallbackRegistry(names: string[], options: RegistryOptions) {
  // 企业私有源和 scope 配置保持封闭，只有已知公共源之间做一次探测。
  if (!PUBLIC_REGISTRIES.includes(options.registry) || Object.keys(options).some(key => key.startsWith('@') && key.endsWith(':registry'))) {
    return
  }
  const registry = PUBLIC_REGISTRIES.find(value => value !== options.registry)!
  const fallback = publicRegistryOptions(options, registry)
  try {
    await queryWithDeadline(async (signal) => {
      const candidates = await Promise.all(names.map(async name => ({
        version: BUNDLED_VERSIONS[name as keyof typeof BUNDLED_VERSIONS],
        versions: await getPackageVersionsFromNpm(name, signal, fallback),
      })))
      if (!findCompatibleVersion(candidates)) {
        throw new Error('备用源尚未同步')
      }
    }, FALLBACK_TIMEOUT_MS)
    logger.warn(`备用源 ${displayRegistry(registry)} 的核心版本可查询；如当前源无法安装，可用 pnpm --config.registry=${registry} install 重试。项目仍保留随包版本。`)
  }
  catch {
    // 诊断失败不影响项目生成，也不延长总网络等待预算。
  }
}

/** 根据当前安装源解析兼容版本；默认离线，并始终保留完整的随包回退组合。 */
export async function resolveDependencyVersions(
  pkg: PackageJson,
  strategy: DependencyVersionStrategy = 'bundled',
  network?: RegistryOptions,
): Promise<ResolutionResult> {
  validateDependencyVersionStrategy(strategy)
  for (const [name, version] of Object.entries(BUNDLED_VERSIONS)) {
    setDependencyVersion(pkg, name, version)
  }

  const names = CORE_PACKAGES.filter(name => hasDependency(pkg, name))
  const tailwindSpec = pkg.devDependencies?.['weapp-tailwindcss']
  if (strategy === 'bundled' || (names.length === 0 && !tailwindSpec)) {
    return { strategy: 'bundled' }
  }

  const bundledDescription = names.map(name => `${name}@${BUNDLED_VERSIONS[name]}`).join('、')
  if (names.some(name => !valid(BUNDLED_VERSIONS[name]) || prerelease(BUNDLED_VERSIONS[name]))) {
    logger.warn(`预发布基线保持随包版本，不自动更新：${bundledDescription}`)
    return { strategy: 'bundled' }
  }

  const options = network ?? await resolveRegistryOptions()
  try {
    // 只收集结果，全部查询完成后才写入，避免取消后的迟到响应改变回退版本。
    const { coreVersion, tailwindVersion } = await queryWithDeadline(async (signal) => {
      const [candidates, tailwindVersions] = await Promise.all([
        Promise.all(names.map(async name => ({
          version: BUNDLED_VERSIONS[name],
          versions: await getPackageVersionsFromNpm(name, signal, options),
        }))),
        tailwindSpec ? getPackageVersionsFromNpm('weapp-tailwindcss', signal, options) : undefined,
      ])
      const coreVersion = findCompatibleVersion(candidates)
      if (names.length && !coreVersion) {
        throw new Error('未找到核心依赖共同发布的兼容稳定版本')
      }
      const tailwindBaseline = tailwindSpec && minVersion(tailwindSpec)?.version
      const tailwindVersion = tailwindBaseline && tailwindVersions
        ? findCompatibleVersion([{
            version: tailwindBaseline,
            versions: tailwindVersions.filter(value => valid(value) && satisfies(value, tailwindSpec!)),
          }])
        : undefined
      if (tailwindSpec && !tailwindVersion) {
        throw new Error('当前源缺少模板兼容的 Tailwind 版本')
      }
      return { coreVersion, tailwindVersion }
    }, PRIMARY_TIMEOUT_MS)
    if (coreVersion) {
      for (const name of names) {
        setDependencyVersion(pkg, name, coreVersion)
      }
    }
    // 精确钉住的模板依赖保持原样，仅提升模板已经声明的兼容范围。
    if (tailwindVersion && tailwindSpec?.startsWith('^') && valid(tailwindSpec.slice(1))) {
      pkg.devDependencies!['weapp-tailwindcss'] = `^${tailwindVersion}`
    }
    return { strategy: 'compatible' }
  }
  catch {
    logger.warn(`当前 registry 的兼容版本查询失败、超时或没有共同版本，已使用随包版本：${bundledDescription}。网络等待总上限为 5 秒。`)
    if (names.length) {
      await suggestFallbackRegistry(names, options)
    }
    return { strategy: 'bundled' }
  }
}
