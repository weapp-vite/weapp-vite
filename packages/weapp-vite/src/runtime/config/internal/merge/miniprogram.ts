import type { RolldownPluginOption } from 'rolldown'
import type { InlineConfig } from 'vite'
import type { MutableCompilerContext } from '../../../../context'
import type { SubPackageMetaValue } from '../../../../types'
import { defu } from '@weapp-core/shared'
import path from 'pathe'
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
    const watchInclude: string[] = [
      path.join(cwd, srcRoot, '**'),
    ]
    const pluginRootConfig = config.weapp?.pluginRoot
    if (pluginRootConfig) {
      const absolutePluginRoot = path.resolve(cwd, pluginRootConfig)
      const relativeToSrc = path.relative(
        path.resolve(cwd, srcRoot),
        absolutePluginRoot,
      )
      const pluginPatternBase = relativeToSrc.startsWith('..')
        ? absolutePluginRoot
        : path.join(cwd, srcRoot, relativeToSrc)
      watchInclude.push(path.join(pluginPatternBase, '**'))
    }

    const inline = defu<InlineConfig, (InlineConfig | undefined)[]>(
      config,
      ...configs,
      {
        root: cwd,
        mode: 'development',
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
  inlineConfig.logLevel = 'info'
  injectBuiltinAliases(inlineConfig)

  const currentRoot = subPackageMeta?.subPackage.root
  setOptions({
    currentSubPackageRoot: currentRoot,
  })

  return inlineConfig
}
