import type { PackageJson } from 'pkg-types'
import type { CompilerContext } from '../CompilerContext'
import { addExtension, defu, removeExtension } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import { type InlineConfig, loadConfigFromFile } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { getOutputExtensions, getWeappViteConfig } from '../../defaults'
import { getAliasEntries, getProjectConfig } from '../../utils'
import { logger } from '../shared'

export async function loadDefaultConfig(this: CompilerContext) {
  const projectConfig = await getProjectConfig(this.cwd)
  this.projectConfig = projectConfig
  if (!this.mpDistRoot) {
    logger.error('请在 `project.config.json` 里设置 `miniprogramRoot`, 比如可以设置为 `dist/` ')
    return
  }
  const packageJsonPath = path.resolve(this.cwd, 'package.json')
  const external: (string | RegExp)[] = []
  if (await fs.exists(packageJsonPath)) {
    const localPackageJson: PackageJson = await fs.readJson(packageJsonPath, {
      throws: false,
    }) || {}
    this.packageJson = localPackageJson
    if (localPackageJson.dependencies) {
      external.push(...Object.keys(localPackageJson.dependencies))
    }
  }

  const loaded = await loadConfigFromFile({
    command: this.isDev ? 'serve' : 'build',
    mode: this.mode,
  }, undefined, this.cwd)

  this.inlineConfig = defu<InlineConfig, (InlineConfig | undefined)[]>({
    configFile: false,
  }, loaded?.config, {
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          strict: false,
          entryFileNames: (chunkInfo) => {
            const name = this.relativeSrcRoot(chunkInfo.name)
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
        // esmExternals: true,
      },
    },
    logLevel: 'warn',
    weapp: getWeappViteConfig(),
  })
  const platform = this.inlineConfig.weapp?.platform
  this.platform = platform!
  this.outputExtensions = getOutputExtensions(platform)
  this.inlineConfig.plugins ??= []
  this.inlineConfig.plugins?.push(tsconfigPaths(this.inlineConfig.weapp?.tsconfigPaths))
  this.aliasEntries = getAliasEntries(this.inlineConfig.weapp?.jsonAlias)
}
