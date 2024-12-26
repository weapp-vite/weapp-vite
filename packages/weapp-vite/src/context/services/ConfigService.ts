import type { PackageJson } from 'pkg-types'
import type { OutputExtensions } from '../../defaults'
import type { SubPackageMetaValue } from '../../types'
import process from 'node:process'
import { addExtension, defu, removeExtension } from '@weapp-core/shared'
import fs from 'fs-extra'
import { injectable } from 'inversify'
import path from 'pathe'
import { type InlineConfig, loadConfigFromFile } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defaultExcluded, getOutputExtensions, getWeappViteConfig } from '../../defaults'
import { vitePluginWeapp } from '../../plugins'
import { getAliasEntries, getProjectConfig } from '../../utils'
import { getCompilerContext } from '../getInstance'
import { logger } from '../shared'

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
    srcRoot,
  }
}

@injectable()
export class ConfigService {
  options!: LoadConfigResult
  outputExtensions!: OutputExtensions

  /**
   * esbuild 定义的环境变量
   */
  defineEnv: Record<string, any>

  constructor(
  ) {
    this.defineEnv = {} // 初始化定义的环境变量对象
  }

  get defineImportMetaEnv() {
    const env = {
      MP_PLATFORM: this.options.platform,
      ...this.defineEnv,
    }
    const define: Record<string, any> = {}
    for (const [key, value] of Object.entries(env)) {
      define[`import.meta.env.${key}`] = JSON.stringify(value)
    }

    define[`import.meta.env`] = JSON.stringify(env)
    return define
  }

  setDefineEnv(key: string, value: any) {
    this.defineEnv[key] = value
  }

  async load(options?: Partial<LoadConfigOptions>) {
    const input = defu<LoadConfigOptions, LoadConfigOptions[]>(options, {
      cwd: process.cwd(),
      isDev: false,
      mode: 'development',
    })
    const rawConfig = await loadConfig(input)

    const resolvedConfig = defu<Required<LoadConfigResult>, Partial<LoadConfigResult>[]>(rawConfig, {
      cwd: process.cwd(), // 当前工作目录，默认为进程的当前目录
      isDev: false, // 是否为开发模式，默认为false
      projectConfig: {}, // 项目配置对象，默认为空对象
      config: {}, // 内联配置对象，默认为空对象
      packageJson: {}, // package.json内容对象，默认为空对象
      platform: 'weapp', // 目标平台，默认为微信小程序平台
    })
    this.options = resolvedConfig
    this.outputExtensions = getOutputExtensions(resolvedConfig.platform) // 根据平台获取输出文件扩展名
    return resolvedConfig
  }

  merge(subPackageMeta?: SubPackageMetaValue, ...configs: Partial<InlineConfig>[]) {
    if (this.options.isDev) {
      return defu<InlineConfig, InlineConfig[]>(
        this.options.config,
        ...configs,
        {
          root: this.options.cwd,
          mode: 'development',
          plugins: [vitePluginWeapp(getCompilerContext(), subPackageMeta)],
          // https://github.com/vitejs/vite/blob/a0336bd5197bb4427251be4c975e30fb596c658f/packages/vite/src/node/config.ts#L1117
          define: this.defineImportMetaEnv,
          build: {
            watch: {
              exclude: [
                ...defaultExcluded,
                this.options.mpDistRoot ? path.join(this.options.mpDistRoot, '**') : 'dist/**',
              ],
              include: [path.join(this.options.srcRoot, '**')],
              chokidar: {
                ignored: [...defaultExcluded],
              },
            },
            minify: false,
            emptyOutDir: false,
          },
        },
      )
    }
    else {
      const inlineConfig = defu<InlineConfig, InlineConfig[]>(
        this.options.config,
        ...configs,
        {
          root: this.options.cwd,
          plugins: [vitePluginWeapp(
            getCompilerContext(),
            subPackageMeta,
          )],
          mode: 'production',
          define: this.defineImportMetaEnv,
          build: {
            emptyOutDir: false,
          },
        },
      )
      inlineConfig.logLevel = 'info'
      return inlineConfig
    }
  }
}
