import type { PackageJson } from 'pkg-types'
import type { OutputExtensions } from '../defaults'
import process from 'node:process'
import { addExtension, defu, removeExtension } from '@weapp-core/shared'
import fs from 'fs-extra'
import { injectable } from 'inversify'
import path from 'pathe'
import { type InlineConfig, loadConfigFromFile } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { getOutputExtensions, getWeappViteConfig } from '../defaults'
import { getAliasEntries, getProjectConfig } from '../utils'
import { logger } from './shared'

export interface LoadConfigOptions {
  cwd: string
  isDev: boolean
  mode: string
}

export type LoadConfigResult = NonNullable<Awaited<ReturnType<typeof loadConfig>>>

export async function loadConfig(opts: LoadConfigOptions) {
  const { cwd, isDev, mode } = opts
  const projectConfig = await getProjectConfig(cwd)
  const mpDistRoot = projectConfig.miniprogramRoot ?? projectConfig.srcMiniprogramRoot
  if (!mpDistRoot) {
    logger.error('请在 `project.config.json` 里设置 `miniprogramRoot`, 比如可以设置为 `dist/` ')
    return
  }
  const packageJsonPath = path.resolve(cwd, 'package.json')
  const external: (string | RegExp)[] = []
  let packageJson: PackageJson = {}
  if (await fs.exists(packageJsonPath)) {
    const localPackageJson: PackageJson = await fs.readJson(packageJsonPath, {
      throws: false,
    }) || {}
    packageJson = localPackageJson
    if (localPackageJson.dependencies) {
      external.push(...Object.keys(localPackageJson.dependencies))
    }
  }

  const loaded = await loadConfigFromFile({
    command: isDev ? 'serve' : 'build',
    mode,
  }, undefined, cwd)

  const loadedConfig = loaded?.config

  const srcRoot = loadedConfig?.weapp?.srcRoot ?? ''
  function relativeSrcRoot(p: string) {
    if (srcRoot) {
      return path.relative(srcRoot, p)
    }
    return p
  }

  const config = defu<InlineConfig, (InlineConfig | undefined)[]>({
    configFile: false,
  }, loadedConfig, {
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          strict: false,
          entryFileNames: (chunkInfo) => {
            const name = relativeSrcRoot(chunkInfo.name)
            if (name.endsWith('.ts')) {
              const baseFileName = removeExtension(name)
              if (baseFileName.endsWith('.wxs')) {
                return baseFileName
              }
              return addExtension(baseFileName, '.js')
            }
            return name
          },
        },
        external,
      },
      assetsDir: '.',
      commonjsOptions: {
        transformMixedEsModules: true,
        include: undefined,
      },
    },
    logLevel: 'warn',
    weapp: getWeappViteConfig(),
  })

  const platform = config.weapp?.platform ?? 'weapp'

  const outputExtensions = getOutputExtensions(platform)
  config.plugins ??= []
  config.plugins?.push(tsconfigPaths(config.weapp?.tsconfigPaths))
  const aliasEntries = getAliasEntries(config.weapp?.jsonAlias)

  return {
    config,
    aliasEntries,
    outputExtensions,
    packageJson,
    relativeSrcRoot,
    cwd,
    isDev,
    mode,
    projectConfig,
    mpDistRoot,
    packageJsonPath,
    platform,
  }
}

@injectable()
export class ConfigService {
  options?: LoadConfigResult

  outputExtensions?: OutputExtensions
  constructor() {
    this.options = undefined
    this.outputExtensions = undefined
  }

  async load(options?: Partial<LoadConfigOptions>) {
    const opts = defu<LoadConfigOptions, LoadConfigOptions[]>(options, {
      cwd: process.cwd(),
      isDev: false,
      mode: 'development',
    })
    const opt = await loadConfig(opts)

    const _opts = defu<Required<LoadConfigResult>, Partial<LoadConfigResult>[]>(opt, {
      cwd: process.cwd(), // 当前工作目录，默认为进程的当前目录
      isDev: false, // 是否为开发模式，默认为false
      projectConfig: {}, // 项目配置对象，默认为空对象
      config: {}, // 内联配置对象，默认为空对象
      packageJson: {}, // package.json内容对象，默认为空对象
      platform: 'weapp', // 目标平台，默认为微信小程序平台
    })
    this.options = _opts
    this.outputExtensions = getOutputExtensions(_opts.platform) // 根据平台获取输出文件扩展名
    return _opts
  }
}
