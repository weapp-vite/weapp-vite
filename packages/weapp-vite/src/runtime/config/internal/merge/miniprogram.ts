import type { RolldownPluginOption } from 'rolldown'
import type { InlineConfig, Logger } from 'vite'
import type { MutableCompilerContext } from '../../../../context'
import type { SubPackageMetaValue } from '../../../../types'
import { defu } from '@weapp-core/shared'
import path from 'pathe'
import { createLogger } from 'vite'
import { defaultExcluded } from '../../../../defaults'
import { applyWeappViteHostMeta } from '../../../../pluginHost'
import { stripRollupOptions } from './inline'
import { arrangePlugins } from './plugins'

const PACKAGE_NAME_REGEX = /[-/\\^$*+?.()|[\]{}]/g

interface MergeMiniprogramOptions {
  ctx: MutableCompilerContext
  subPackageMeta: SubPackageMetaValue | undefined
  config: InlineConfig
  cwd: string
  srcRoot: string
  mpDistRoot?: string
  packageJson: { dependencies?: Record<string, string> } | undefined
  isDev: boolean
  applyRuntimePlatform: (runtime: 'miniprogram' | 'web') => void
  injectBuiltinAliases: (config: InlineConfig) => void
  getDefineImportMetaEnv: () => Record<string, any>
  setOptions: (current: { currentSubPackageRoot?: string }) => void
  oxcRolldownPlugin: RolldownPluginOption<any> | undefined
}

export function resolveMiniprogramWatchInclude(options: {
  cwd: string
  srcRoot: string
  pluginRoot?: string
}) {
  const watchInclude: string[] = [
    path.join(options.cwd, options.srcRoot, '**'),
  ]

  if (!options.pluginRoot) {
    return watchInclude
  }

  const absolutePluginRoot = path.resolve(options.cwd, options.pluginRoot)
  const relativeToSrc = path.relative(
    path.resolve(options.cwd, options.srcRoot),
    absolutePluginRoot,
  )
  const pluginPatternBase = relativeToSrc.startsWith('..')
    ? absolutePluginRoot
    : path.join(options.cwd, options.srcRoot, relativeToSrc)

  watchInclude.push(path.join(pluginPatternBase, '**'))
  return watchInclude
}

export function mergeMiniprogram(options: MergeMiniprogramOptions, ...configs: Partial<InlineConfig | undefined>[]) {
  const {
    ctx,
    subPackageMeta,
    config,
    cwd,
    srcRoot,
    mpDistRoot,
    packageJson,
    isDev,
    applyRuntimePlatform,
    injectBuiltinAliases,
    getDefineImportMetaEnv,
    setOptions,
    oxcRolldownPlugin,
  } = options

  applyRuntimePlatform('miniprogram')

  const createMiniprogramCustomLogger = (): Logger => {
    return createLogger('warn')
  }

  const external: (string | RegExp)[] = []
  if (packageJson?.dependencies) {
    external.push(
      ...Object.keys(packageJson.dependencies).map((pkg) => {
        return new RegExp(`^${pkg.replace(PACKAGE_NAME_REGEX, '\\$&')}(\\/|$)`)
      }),
    )
  }

  const rolldownOptions = {
    external,
    plugins: oxcRolldownPlugin ? [oxcRolldownPlugin] : undefined,
  }

  const miniprogramDefines = {
    ...getDefineImportMetaEnv(),
    // Vite 动态导入预加载 helper 依赖该标记，miniprogram 构建需稳定替换为 false。
    __VITE_IS_MODERN__: 'false',
  }

  if (isDev) {
    const watchInclude = resolveMiniprogramWatchInclude({
      cwd,
      srcRoot,
      pluginRoot: config.weapp?.pluginRoot,
    })

    const inline = defu<InlineConfig, (InlineConfig | undefined)[]>(
      config,
      ...configs,
      {
        root: cwd,
        mode: 'development',
        customLogger: createMiniprogramCustomLogger(),
        define: miniprogramDefines,
        build: {
          modulePreload: false,
          watch: {
            exclude: [
              ...defaultExcluded,
              mpDistRoot
                ? path.join(cwd, mpDistRoot, '**')
                : path.join(cwd, 'dist', '**'),
            ],
            include: watchInclude,
          },
          minify: false,
          emptyOutDir: false,
          // @ts-ignore
          rolldownOptions: {
            ...rolldownOptions,
          },
          sourcemap: false,
        },
      },
    )
    inline.define = {
      ...(inline.define ?? {}),
      __VITE_IS_MODERN__: 'false',
    }
    applyWeappViteHostMeta(inline, 'miniprogram')
    stripRollupOptions(inline)
    arrangePlugins(inline, ctx, subPackageMeta)
    injectBuiltinAliases(inline)
    return inline
  }

  const inlineConfig = defu<InlineConfig, (InlineConfig | undefined)[]>(
    config,
    ...configs,
    {
      root: cwd,
      mode: 'production',
      define: miniprogramDefines,
      build: {
        modulePreload: false,
        emptyOutDir: false,
        // @ts-ignore
        rolldownOptions: {
          ...rolldownOptions,
        },
      },
    },
  )
  inlineConfig.define = {
    ...(inlineConfig.define ?? {}),
    __VITE_IS_MODERN__: 'false',
  }
  applyWeappViteHostMeta(inlineConfig, 'miniprogram')
  stripRollupOptions(inlineConfig)
  arrangePlugins(inlineConfig, ctx, subPackageMeta)
  inlineConfig.logLevel = 'warn'
  injectBuiltinAliases(inlineConfig)

  const currentRoot = subPackageMeta?.subPackage.root
  setOptions({
    currentSubPackageRoot: currentRoot,
  })

  return inlineConfig
}
