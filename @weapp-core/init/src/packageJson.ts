import type { PackageJson } from 'pkg-types'
import type { UpdatePackageJsonOptions } from './types'
import logger from '@weapp-core/logger'
import { defu, get, set } from '@weapp-core/shared'
import path from 'pathe'
import { version } from '../../../packages/weapp-vite/package.json'
import { latestVersion } from './npm'
import { ctx } from './state'
import { readJsonIfExists, writeJsonFile } from './utils/fs'
import { resolveOutputPath } from './utils/path'

const FALLBACK_DEP_VERSIONS: Record<string, string> = {
  'miniprogram-api-typings': '^4.1.0',
  'typescript': '^5.9.2',
  'weapp-tailwindcss': '^4.3.3',
}

/**
 * @description 创建默认 package.json 模板
 */
export function createDefaultPackageJson(): PackageJson {
  return {
    name: 'weapp-vite-app',
    homepage: 'https://vite.icebreaker.top/',
    type: 'module',
    scripts: {},
    devDependencies: {},
  }
}

/**
 * @description 写入/更新依赖版本
 */
export async function upsertDependencyVersion(
  packageJson: PackageJson,
  keyPath: string,
  packageName: string,
  options: { skipNetwork?: boolean } = {},
) {
  const currentValue = get(packageJson, keyPath)
  const resolved = options.skipNetwork ? null : await latestVersion(packageName)

  if (resolved) {
    set(packageJson, keyPath, resolved)
    return
  }

  if (currentValue === undefined) {
    const fallback = FALLBACK_DEP_VERSIONS[packageName] ?? 'latest'
    set(packageJson, keyPath, fallback)
  }
}

/**
 * @description 创建或更新 package.json
 */
export async function createOrUpdatePackageJson(options: UpdatePackageJsonOptions) {
  const { root, dest, command, cb, write, filename } = defu<
    Required<UpdatePackageJsonOptions>,
    Partial<UpdatePackageJsonOptions>[]
  >(options, {
    write: true,
    filename: 'package.json',
    command: 'weapp-vite',
  })

  const packageJsonFilename = ctx.packageJson.name = filename
  const packageJsonPath = ctx.packageJson.path = path.resolve(root, packageJsonFilename)
  const outputPath = resolveOutputPath(root, dest, packageJsonPath)

  try {
    let packageJson = await readJsonIfExists<PackageJson>(packageJsonPath)

    if (!packageJson) {
      packageJson = createDefaultPackageJson()
      logger.info(`✨ 没有找到 ${packageJsonFilename} 文件，正在创建默认 package.json ...`)
    }

    set(packageJson, 'scripts.dev', `${command} dev`)
    set(packageJson, 'scripts.dev:open', `${command} dev -o`)
    set(packageJson, 'scripts.build', `${command} build`)

    if (command === 'weapp-vite') {
      set(packageJson, 'scripts.open', `${command} open`)
      set(packageJson, 'scripts.g', `${command} generate`)
      set(packageJson, 'devDependencies.weapp-vite', `^${version}`)
      await Promise.all([
        upsertDependencyVersion(packageJson, 'devDependencies.miniprogram-api-typings', 'miniprogram-api-typings', { skipNetwork: !write }),
        upsertDependencyVersion(packageJson, 'devDependencies.typescript', 'typescript', { skipNetwork: !write }),
      ])
    }

    cb?.(
      (...args) => {
        set(packageJson, ...args)
      },
    )

    ctx.packageJson.value = packageJson

    if (write) {
      await writeJsonFile(outputPath, packageJson)
      logger.log(`✨ 写入 ${path.relative(root, outputPath)} 成功!`)
    }

    return packageJson
  }
  catch (error) {
    logger.error(`⚠️ 设置 ${packageJsonFilename} 配置文件失败`, error)
    throw error
  }
}
