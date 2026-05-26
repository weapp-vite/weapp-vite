import type { RolldownPluginOption } from 'rolldown'
import type { InlineConfig, Logger } from 'vite'
import type { MutableCompilerContext } from '../../../../context'
import type { WeappVitePlatform } from '../../../../runtimeTarget'
import type { SubPackageMetaValue } from '../../../../types'
import { defu } from '@weapp-core/shared'
import path from 'pathe'
import { createLogger } from 'vite'
import { defaultExcluded } from '../../../../defaults'
import { applyWeappViteHostMeta } from '../../../../pluginHost'
import { resolveBuildScope } from '../../../buildScope'
import { resolveNpmBuildCandidateDependenciesSync } from '../../../npmPlugin/service'
import { resolveBuiltinPackageAliases } from '../../../packageAliases'
import { stripRollupOptions } from './inline'
import { arrangePlugins } from './plugins'

const PACKAGE_NAME_REGEX = /[-/\\^$*+?.()|[\]{}]/g
const PATH_SEPARATOR_SPLIT_REGEX = /[/\\]+/
type WatchIncludePattern = string | RegExp

function escapeRegex(value: string) {
  return value.replace(PACKAGE_NAME_REGEX, '\\$&')
}

function createAbsolutePathPattern(value: string) {
  return value
    .split(PATH_SEPARATOR_SPLIT_REGEX)
    .map(segment => escapeRegex(segment))
    .join('[/\\\\]+')
}

function normalizeInlineConfigAfterDefu(
  inline: InlineConfig,
  options: {
    ctx: MutableCompilerContext
    platform: WeappVitePlatform | undefined
    rolldownOptions: Record<string, unknown>
    subPackageMeta: SubPackageMetaValue | undefined
  },
) {
  const { ctx, platform, rolldownOptions, subPackageMeta } = options
  const build = inline.build ?? (inline.build = {})
  const userRolldownOptions = build.rolldownOptions as Record<string, any> | undefined
  const mergedRolldownOptions = {
    ...(userRolldownOptions ?? {}),
    ...rolldownOptions,
    output: {
      ...(rolldownOptions.output as Record<string, unknown> | undefined),
      ...(userRolldownOptions?.output ?? {}),
    },
  }
  build.rolldownOptions = mergedRolldownOptions
  inline.define = {
    ...(inline.define ?? {}),
    __VITE_IS_MODERN__: 'false',
  }
  applyWeappViteHostMeta(inline, 'miniprogram', platform)
  stripRollupOptions(inline)
  arrangePlugins(inline, ctx, subPackageMeta)
}

interface MergeMiniprogramOptions {
  ctx: MutableCompilerContext
  subPackageMeta: SubPackageMetaValue | undefined
  config: InlineConfig
  cwd: string
  srcRoot: string
  mpDistRoot?: string
  configFileDependencies?: string[]
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
  buildScope?: ReturnType<typeof resolveBuildScope>
  userInclude?: WatchIncludePattern | WatchIncludePattern[]
  configFileDependencies?: string[]
}) {
  const srcRoot = path.join(options.cwd, options.srcRoot)
  const startupWatchInclude: WatchIncludePattern[] = options.buildScope?.enabled
    ? [
        ...options.buildScope.includeMainPackage ? [path.join(srcRoot, 'pages', '**')] : [],
        ...options.buildScope.subPackageRoots.map(root => path.join(srcRoot, root, '**')),
      ]
    : [
        path.join(srcRoot, '**'),
      ]
  const watchInclude: WatchIncludePattern[] = [
    // Rolldown 的 include 会过滤已发现的依赖图模块。保留一个全量兜底，
    // 避免 link / monorepo 中 srcRoot 外部模块通过 addWatchFile 进入图后被过滤。
    '**',
    ...startupWatchInclude,
  ]

  if (options.pluginRoot) {
    const absolutePluginRoot = path.resolve(options.cwd, options.pluginRoot)
    const relativeToSrc = path.relative(
      path.resolve(options.cwd, options.srcRoot),
      absolutePluginRoot,
    )
    const pluginPatternBase = relativeToSrc.startsWith('..')
      ? absolutePluginRoot
      : path.join(options.cwd, options.srcRoot, relativeToSrc)

    watchInclude.push(path.join(pluginPatternBase, '**'))
  }

  for (const dependency of options.configFileDependencies ?? []) {
    watchInclude.push(dependency)
  }

  const userInclude = Array.isArray(options.userInclude)
    ? options.userInclude
    : options.userInclude
      ? [options.userInclude]
      : []
  const seen = new Set<string>()
  return [...userInclude, ...watchInclude].filter((item) => {
    if (typeof item !== 'string') {
      return true
    }
    if (seen.has(item)) {
      return false
    }
    seen.add(item)
    return true
  })
}

export function mergeMiniprogram(options: MergeMiniprogramOptions, ...configs: Partial<InlineConfig | undefined>[]) {
  const {
    ctx,
    subPackageMeta,
    config,
    cwd,
    srcRoot,
    mpDistRoot,
    configFileDependencies = [],
    packageJson,
    isDev,
    applyRuntimePlatform,
    injectBuiltinAliases,
    getDefineImportMetaEnv,
    setOptions,
    oxcRolldownPlugin,
  } = options
  const platform = ctx.configService?.platform

  applyRuntimePlatform('miniprogram')

  const createMiniprogramCustomLogger = (): Logger => {
    return createLogger('warn')
  }

  const external: (string | RegExp)[] = []
  const npmBuildCandidates = packageJson
    ? resolveNpmBuildCandidateDependenciesSync(ctx, packageJson)
    : []
  if (npmBuildCandidates.length > 0) {
    const builtinAliases = resolveBuiltinPackageAliases({
      isDev,
      wevuRuntime: config.weapp?.wevu?.runtime,
    })
    external.push(
      ...npmBuildCandidates.map((pkg) => {
        return new RegExp(`^${escapeRegex(pkg)}(\\/|$)`)
      }),
      ...builtinAliases
        .filter(({ find }) => {
          return npmBuildCandidates.some(dep => find === dep || find.startsWith(`${dep}/`))
        })
        .map(({ replacement }) => {
          return new RegExp(`^${createAbsolutePathPattern(replacement)}(?:\\?.*)?$`)
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
    const hmrWatchBuildDelay = 60
    const watchInclude = resolveMiniprogramWatchInclude({
      cwd,
      srcRoot,
      pluginRoot: config.weapp?.pluginRoot,
      buildScope: resolveBuildScope(config.weapp?.buildScope),
      configFileDependencies,
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
            buildDelay: hmrWatchBuildDelay,
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
    normalizeInlineConfigAfterDefu(inline, {
      ctx,
      platform,
      rolldownOptions,
      subPackageMeta,
    })
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
        minify: false,
        emptyOutDir: false,
        // @ts-ignore
        rolldownOptions: {
          ...rolldownOptions,
        },
      },
    },
  )
  normalizeInlineConfigAfterDefu(inlineConfig, {
    ctx,
    platform,
    rolldownOptions,
    subPackageMeta,
  })
  inlineConfig.logLevel = 'warn'
  injectBuiltinAliases(inlineConfig)

  const currentRoot = subPackageMeta?.subPackage.root
  setOptions({
    currentSubPackageRoot: currentRoot,
  })

  return inlineConfig
}
