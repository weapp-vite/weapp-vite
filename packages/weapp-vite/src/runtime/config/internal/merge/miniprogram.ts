import type { RolldownPluginOption } from 'rolldown'
import type { InlineConfig, Logger } from 'vite'
import type { MutableCompilerContext } from '../../../../context'
import type { WeappVitePlatform } from '../../../../runtimeTarget'
import type { SubPackageMetaValue } from '../../../../types'
import { existsSync, readFileSync } from 'node:fs'
import { defu } from '@weapp-core/shared'
import { parse as parseJson } from 'comment-json'
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

function hasTsconfigReference(tsconfig: string, target: string) {
  if (!existsSync(tsconfig)) {
    return false
  }

  try {
    const parsed = parseJson(readFileSync(tsconfig, 'utf8'), undefined, true) as { references?: unknown }
    const references = Array.isArray(parsed.references) ? parsed.references : []
    const tsconfigDir = path.dirname(tsconfig)
    return references.some((reference) => {
      if (!reference || typeof reference !== 'object' || typeof (reference as { path?: unknown }).path !== 'string') {
        return false
      }

      return path.resolve(tsconfigDir, (reference as { path: string }).path) === target
    })
  }
  catch {
    return false
  }
}

function resolveDefaultRolldownTsconfig(cwd: string) {
  const appTsconfig = path.resolve(cwd, '.weapp-vite/tsconfig.app.json')
  const rootTsconfig = path.resolve(cwd, 'tsconfig.json')
  if (existsSync(appTsconfig)) {
    return appTsconfig
  }

  if (hasTsconfigReference(rootTsconfig, appTsconfig)) {
    return appTsconfig
  }

  if (existsSync(rootTsconfig)) {
    return rootTsconfig
  }

  return undefined
}

function normalizeInlineConfigAfterDefu(
  inline: InlineConfig,
  options: {
    cwd: string
    ctx: MutableCompilerContext
    platform: WeappVitePlatform | undefined
    rolldownOptions: Record<string, unknown>
    subPackageMeta: SubPackageMetaValue | undefined
  },
) {
  const { cwd, ctx, platform, rolldownOptions, subPackageMeta } = options
  const build = inline.build ?? (inline.build = {})
  const userRolldownOptions = build.rolldownOptions as Record<string, any> | undefined
  const mergedRolldownOptions: Record<string, any> = {
    ...(userRolldownOptions ?? {}),
    ...rolldownOptions,
    output: {
      ...(rolldownOptions.output as Record<string, unknown> | undefined),
      ...(userRolldownOptions?.output ?? {}),
    },
  }
  const defaultTsconfig = resolveDefaultRolldownTsconfig(cwd)
  if (
    !Object.prototype.hasOwnProperty.call(mergedRolldownOptions, 'tsconfig')
    && !(mergedRolldownOptions.resolve as { tsconfigFilename?: unknown } | undefined)?.tsconfigFilename
    && defaultTsconfig
  ) {
    mergedRolldownOptions.tsconfig = defaultTsconfig
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
  const include = [...userInclude, ...watchInclude]
  const seen = new Set<string>()
  return include.filter((item) => {
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
    const hmrWatchBuildDelay = 10
    const userBuildWatch = config.build?.watch
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
            ...(typeof userBuildWatch === 'object' && userBuildWatch
              ? userBuildWatch
              : {}),
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
    inline.build!.watch!.include = resolveMiniprogramWatchInclude({
      cwd,
      srcRoot,
      pluginRoot: config.weapp?.pluginRoot,
      buildScope: resolveBuildScope(config.weapp?.buildScope),
      userInclude: inline.build?.watch?.include,
      configFileDependencies,
    })
    normalizeInlineConfigAfterDefu(inline, {
      cwd,
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
  if (inlineConfig.build) {
    delete inlineConfig.build.watch
  }
  normalizeInlineConfigAfterDefu(inlineConfig, {
    cwd,
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
