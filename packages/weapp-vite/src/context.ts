import type { FSWatcher } from 'chokidar'
import type { PackageJson } from 'pkg-types'
import type { RollupOutput, RollupWatcher } from 'rollup'
import type { SubPackage, WatchOptions } from './types'
import { createRequire } from 'node:module'
import process from 'node:process'
import { addExtension, defu, isObject, removeExtension } from '@weapp-core/shared'
import { watch } from 'chokidar'
import { parse as parseJson } from 'comment-json'
import fs from 'fs-extra'
import path from 'pathe'
import { build as tsupBuild } from 'tsup'
import { build, type InlineConfig, loadConfigFromFile } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { getWeappWatchOptions } from './defaults'
import logger from './logger'
import { vitePluginWeapp } from './plugins'
import { changeFileExtension, findJsEntry, getProjectConfig, type ProjectConfig } from './utils'
import './config'

function parseCommentJson(json: string) {
  try {
    return parseJson(json, undefined, true)
  }
  catch {

  }
}

const require = createRequire(import.meta.url)

export interface CompilerContextOptions {
  cwd: string
  inlineConfig?: InlineConfig
  isDev?: boolean
  projectConfig?: ProjectConfig
  type?: 'app' | 'subPackage'
  mode?: string
  packageJson?: PackageJson
  subPackage?: SubPackage
}
export class CompilerContext {
  inlineConfig: InlineConfig
  cwd: string
  isDev: boolean
  projectConfig: ProjectConfig
  mode: string
  packageJson: PackageJson
  subPackage?: SubPackage
  watcherMap: Map<string | symbol, RollupWatcher | FSWatcher>
  subPackageContextMap: Map<string, CompilerContext>
  type: CompilerContextOptions['type']
  parent?: CompilerContext
  entries: Set<string>

  constructor(options?: CompilerContextOptions) {
    const { cwd, isDev, inlineConfig, projectConfig, mode, packageJson, subPackage, type } = defu<Required<CompilerContextOptions>, CompilerContextOptions[]>(options, {
      cwd: process.cwd(),
      isDev: false,
      projectConfig: {},
      type: 'app',
      inlineConfig: {},
      mode: '',
      packageJson: {},
    })
    this.cwd = cwd
    this.inlineConfig = inlineConfig
    this.isDev = isDev
    this.projectConfig = projectConfig
    this.mode = mode
    this.packageJson = packageJson
    this.subPackage = subPackage
    this.watcherMap = new Map()
    this.subPackageContextMap = new Map()
    this.type = type
    this.entries = new Set()
  }

  get srcRoot() {
    return this.inlineConfig?.weapp?.srcRoot ?? ''
  }

  relativeSrcRoot(p: string) {
    if (this.srcRoot) {
      return path.relative(this.srcRoot, p)
    }
    return p
  }

  get mpDistRoot(): string {
    return this.projectConfig.miniprogramRoot || this.projectConfig.srcMiniprogramRoot || ''
  }

  forkSubPackage(subPackage: SubPackage): CompilerContext {
    const ctx = new CompilerContext({
      cwd: this.cwd,
      isDev: this.isDev,
      projectConfig: this.projectConfig,
      inlineConfig: this.inlineConfig,
      type: 'subPackage',
      mode: this.mode,
      subPackage,
    })
    this.subPackageContextMap.set(subPackage.root, ctx)
    ctx.parent = this
    return ctx
  }

  private async internalDev(inlineConfig: InlineConfig) {
    const rollupWatcher = (await build(
      inlineConfig,
    )) as RollupWatcher
    const key = 'rollup'
    const watcher = this.watcherMap.get(key)
    watcher?.close()
    this.watcherMap.set(key, rollupWatcher)
    return rollupWatcher
  }

  async runDev() {
    if (process.env.NODE_ENV === undefined) {
      process.env.NODE_ENV = 'development'
    }

    const inlineConfig = defu<InlineConfig, InlineConfig[]>(
      this.inlineConfig,
      {
        root: this.cwd,
        mode: 'development',
        plugins: [vitePluginWeapp(this)],
        build: {
          watch: {
            exclude: ['node_modules/**', this.mpDistRoot ? path.join(this.mpDistRoot, '**') : 'dist/**'],
          },
          minify: false,
          emptyOutDir: false,
        },
        weapp: {
          type: 'app',
        },
      },
    )

    const getWatcher = (paths: readonly string[], opts: WatchOptions, inlineConfig: InlineConfig) => {
      const watcher = watch(paths, opts)
      let isReady = false
      watcher.on('all', async (eventName) => {
        if (isReady && (eventName === 'add' || eventName === 'change' || eventName === 'unlink')) {
          await this.internalDev(inlineConfig)
        }
      }).on('ready', async () => {
        await this.internalDev(inlineConfig)
        isReady = true
      })

      return watcher
    }

    // 小程序分包的情况，再此创建一个 watcher
    if (this.type === 'subPackage' && this.subPackage) {
      const subPackageInlineConfig = Object.assign({}, inlineConfig, {
        weapp: {
          srcRoot: this.parent?.srcRoot,
          type: this.type,
          subPackage: this.subPackage,
        },
      })
      const { paths, ...opts } = defu<Required<WatchOptions>, WatchOptions[]>(
        subPackageInlineConfig.weapp?.watch,
        {
          cwd: path.join(this.cwd, subPackageInlineConfig.weapp.srcRoot ?? '', this.subPackage.root),
        },
        getWeappWatchOptions(),
      )
      const watcher = getWatcher(paths, opts, subPackageInlineConfig)

      this.watcherMap.set(this.subPackage.root, watcher)

      return watcher
    }
    else if (this.type === 'app') {
      const { paths, ...opts } = defu<Required<WatchOptions>, WatchOptions[]>(
        inlineConfig.weapp?.watch,
        {
          ignored: [
            path.join(this.mpDistRoot, '**'),
          ],
          cwd: this.cwd,
        },
        getWeappWatchOptions(),
      )

      const watcher = getWatcher(paths, opts, inlineConfig)

      this.watcherMap.set('/', watcher)

      return watcher
    }
  }

  async runProd() {
    const inlineConfig = defu<InlineConfig, InlineConfig[]>(
      this.inlineConfig,
      {
        root: this.cwd,
        plugins: [vitePluginWeapp(this)],
        mode: 'production',
        weapp: {
          type: 'app',
        },
      },
    )
    if (this.type === 'subPackage' && this.subPackage) {
      const subPackageInlineConfig = Object.assign({}, inlineConfig, {
        weapp: {
          srcRoot: this.parent?.srcRoot,
          type: this.type,
          subPackage: this.subPackage,
        },
      })
      const output = (await build(
        subPackageInlineConfig,
      )) as RollupOutput | RollupOutput[]

      return output
    }
    else if (this.type === 'app') {
      const output = (await build(
        inlineConfig,
      )) as RollupOutput | RollupOutput[]

      return output
    }
  }

  build() {
    if (this.isDev) {
      return this.runDev()
    }
    else {
      return this.runProd()
    }
  }

  async loadDefaultConfig() {
    const projectConfig = getProjectConfig(this.cwd)
    this.projectConfig = projectConfig
    const packageJsonPath = path.resolve(this.cwd, 'package.json')
    const external: string[] = []
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
      mode: this.mode,
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
                  return path.normalize((baseFileName))
                }
                return path.normalize(addExtension(baseFileName, '.js'))
              }
              return path.normalize(name)
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
      logLevel: 'info',
      plugins: [
        tsconfigPaths(),
      ],
      configFile: false,
    }, loaded?.config, this.inlineConfig)
  }

  // https://cn.vitejs.dev/guide/build.html#library-mode
  // miniprogram_dist
  // miniprogram
  // https://developers.weixin.qq.com/miniprogram/dev/devtools/npm.html#%E8%87%AA%E5%AE%9A%E4%B9%89%E7%BB%84%E4%BB%B6%E7%9B%B8%E5%85%B3%E7%A4%BA%E4%BE%8B
  async buildNpm(options?: { sourcemap?: boolean }) {
    const { sourcemap } = defu(options, { sourcemap: true })
    let packNpmRelationList: {
      packageJsonPath: string
      miniprogramNpmDistDir: string
    }[] = []
    if (this.projectConfig.setting?.packNpmManually && Array.isArray(this.projectConfig.setting.packNpmRelationList)) {
      packNpmRelationList = this.projectConfig.setting.packNpmRelationList
    }
    else {
      packNpmRelationList = [
        {
          miniprogramNpmDistDir: '.',
          packageJsonPath: './package.json',
        },
      ]
    }
    for (const relation of packNpmRelationList) {
      const packageJsonPath = path.resolve(this.cwd, relation.packageJsonPath)
      if (await fs.exists(packageJsonPath)) {
        const pkgJson: PackageJson = await fs.readJson(packageJsonPath)
        const outDir = path.resolve(this.cwd, relation.miniprogramNpmDistDir, 'miniprogram_npm')
        if (pkgJson.dependencies) {
          const dependencies = Object.keys(pkgJson.dependencies)
          if (dependencies.length > 0) {
            for (const dep of dependencies) {
              const id = `${dep}/package.json`
              const targetJson = require(id)

              if ('miniprogram' in targetJson && targetJson.miniprogram) {
                const targetJsonPath = require.resolve(id)
                await fs.copy(
                  path.resolve(
                    path.dirname(targetJsonPath),
                    targetJson.miniprogram,
                  ),
                  path.join(outDir, dep),
                )
              }
              else {
                await tsupBuild({
                  entry: {
                    index: require.resolve(dep),
                  },
                  format: ['cjs'],
                  outDir: path.join(outDir, dep),
                  silent: true,
                  shims: true,
                  outExtension: () => {
                    return {
                      js: '.js',
                    }
                  },
                  sourcemap,
                })
              }
              logger.success(`${dep} 依赖处理完成!`)
            }
          }
        }
      }
    }
  }

  private async usingComponentsHandler(usingComponents: Record<string, string>, dirname: string) {
    // this.packageJson.dependencies
    if (usingComponents) {
      for (const componentUrl of Object.values(usingComponents)) {
        if (/plugin:\/\//.test(componentUrl)) {
          // console.log(`发现插件 ${usingComponent}`)
          continue
        }
        const tokens = componentUrl.split('/')
        if (tokens[0] && isObject(this.packageJson.dependencies) && Reflect.has(this.packageJson.dependencies, tokens[0])) {
          continue
        }
        // start with '/'
        else if (tokens[0] === '') {
          await this.scanComponentEntry(componentUrl.substring(1), path.resolve(this.cwd, this.srcRoot))
        }
        else {
          await this.scanComponentEntry(componentUrl, dirname)
        }
      }
    }
  }

  async scanAppEntry() {
    const appDirname = path.resolve(this.cwd, this.srcRoot)
    const appConfigFile = path.resolve(appDirname, 'app.json')
    const appEntry = await findJsEntry(appConfigFile)
    // https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html
    // js + json
    if (appEntry && await fs.exists(appConfigFile)) {
      const config = parseCommentJson(await fs.readFile(appConfigFile, 'utf8')) as unknown as {
        pages: string[]
        usingComponents: Record<string, string>
        subpackages: SubPackage[]
        subPackages: SubPackage[]
      }
      if (isObject(config)) {
        this.entries.add(appEntry)

        const { pages, usingComponents, subpackages = [], subPackages = [] } = config
        // https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages/basic.html
        // 优先 subPackages
        const subs: SubPackage[] = [...subpackages, ...subPackages]

        await this.usingComponentsHandler(usingComponents, appDirname)

        if (Array.isArray(pages)) {
          for (const page of pages) {
            await this.scanComponentEntry(page, appDirname)
          }
        }

        for (const sub of subs) {
          if (Array.isArray(sub.pages)) {
            for (const page of sub.pages) {
              await this.scanComponentEntry(path.join(sub.root, page), appDirname)
            }
          }
          if (sub.entry) {
            await this.scanComponentEntry(path.join(sub.root, sub.entry), appDirname)
          }
        }
      }
    }
  }

  // usingComponents
  // subpackages / subPackages
  // pages
  // https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html
  // 页面可以没有 JSON
  async scanComponentEntry(componentEntry: string, dirname: string) {
    const entry = path.resolve(dirname, componentEntry)
    const jsEntry = await findJsEntry(entry)
    if (jsEntry) {
      this.entries.add(jsEntry)
    }
    const configFile = changeFileExtension(entry, 'json')
    if (await fs.exists(configFile)) {
      const config = parseCommentJson(await fs.readFile(configFile, 'utf8')) as unknown as {
        usingComponents: Record<string, string>
      }
      if (isObject(config)) {
        const { usingComponents } = config
        await this.usingComponentsHandler(usingComponents, path.dirname(configFile))
      }
    }
  }
}
