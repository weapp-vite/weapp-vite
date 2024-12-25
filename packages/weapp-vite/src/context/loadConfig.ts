import type { PackageJson } from 'pkg-types'
import { addExtension, defu, removeExtension } from '@weapp-core/shared'
import fs from 'fs-extra'
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

export type LoadConfigResult = Awaited<ReturnType<typeof loadConfig>>

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

  const platform = config.weapp?.platform

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
  }
}
