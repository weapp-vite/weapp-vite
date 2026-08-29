import type { OutputBundle } from 'rolldown'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import process from 'node:process'
import { defineConfig } from 'weapp-vite'

const issue393ChunkModeEnabled = process.env.WEAPP_GITHUB_ISSUE_393 === 'true'
const issue510AugmentedEnabled = process.env.WEAPP_GITHUB_ISSUE_510_AUGMENTED === 'true'
const issue547AugmentedEnvEnabled = process.env.WEAPP_GITHUB_ISSUE_547_AUGMENTED === 'true'
const issue558AugmentedEnvEnabled = process.env.WEAPP_GITHUB_ISSUE_558_AUGMENTED === 'true'
const issue564AugmentedEnvEnabled = process.env.WEAPP_GITHUB_ISSUE_564_AUGMENTED === 'true'
const issue615AugmentedEnvEnabled = process.env.WEAPP_GITHUB_ISSUE_615_AUGMENTED === 'true'
const issue621AugmentedEnvEnabled = process.env.WEAPP_GITHUB_ISSUE_621_AUGMENTED === 'true'
const issue595ScopedBuildEnabled = process.env.WEAPP_GITHUB_ISSUE_595_SCOPED === 'true'
const issue642ScopedBuildEnabled = process.env.WEAPP_GITHUB_ISSUE_642_SCOPED === 'true'
const issue724ProbeEnabled = process.env.WEAPP_GITHUB_ISSUE_724_PROBE === 'true'
const issue779CssPreEnabled = process.env.WEAPP_GITHUB_ISSUE_779_CSS_PRE === 'true'
const e2eTargetFile = process.env.WEAPP_VITE_E2E_TARGET_FILE?.replaceAll('\\', '/') ?? ''
const issue826PreserveEnabled = process.env.WEAPP_GITHUB_ISSUE_826_PRESERVE === 'true'
  || e2eTargetFile.endsWith('github-issues.runtime.issue826.test.ts')
const issue845I18nEnabled = process.env.WEAPP_GITHUB_ISSUE_845_I18N === 'true'
const issue850OutputReplayEnabled = process.env.WEAPP_GITHUB_ISSUE_850_OUTPUT_REPLAY === 'true'
const issue793BuildScope = process.env.WEAPP_GITHUB_ISSUE_793_BUILD_SCOPE
const issue793BuildScopeEnabled = issue793BuildScope === 'true'
  || issue793BuildScope === 'subpackage'
  || issue793BuildScope === 'main-with-subpackage'
const issue651NoExtResolvedId = path.resolve(import.meta.dirname, 'src/issue-fixtures/issue-651/ResolverNoExt/index')
const issue651WithExtResolvedId = path.resolve(import.meta.dirname, 'src/issue-fixtures/issue-651/ResolverWithExt/index.vue')
const slotFallbackCompilerOffEnabled = process.env.WEAPP_GITHUB_SLOT_FALLBACK_COMPILER_OFF === 'true'
  || e2eTargetFile.endsWith('github-issues.runtime.slot-fallback-compiler-off.test.ts')
const issue642Bug7DefaultEnabled = e2eTargetFile.endsWith('github-issues.runtime.issue642-bug7-default.test.ts')
const issue642Bug7PerformanceEnabled = e2eTargetFile.endsWith('github-issues.runtime.issue642-bug7-performance.test.ts')
const githubIssuesAggregateTargets = {
  'github-issues.runtime.aggregate.test.ts': [
    'github-issues.runtime.app-shell.test.ts',
    'github-issues.runtime.issue289.test.ts',
    'github-issues.runtime.issue297-302.test.ts',
    'github-issues.runtime.web-runtime.test.ts',
    'github-issues.runtime.import-meta.test.ts',
    'github-issues.runtime.issue466.test.ts',
    'github-issues.runtime.issue553-555.test.ts',
    'github-issues.runtime.issue554.test.ts',
    'github-issues.runtime.issue564.test.ts',
    'github-issues.runtime.issue581.test.ts',
    'github-issues.runtime.issue627.test.ts',
    'github-issues.runtime.issue642.test.ts',
    'github-issues.runtime.issue705.test.ts',
    'github-issues.runtime.issue706.test.ts',
    'github-issues.runtime.issue829.test.ts',
    'github-issues.runtime.lifecycle.test.ts',
    'github-issues.runtime.miniprogram-computed.test.ts',
    'github-issues.runtime.props.test.ts',
    'github-issues.runtime.slot-fallback.test.ts',
  ],
} as const
const issue547AugmentedEnabled = issue547AugmentedEnvEnabled || e2eTargetFile.endsWith('github-issues.runtime.issue547.test.ts')
const issue558AugmentedEnabled = issue558AugmentedEnvEnabled || e2eTargetFile.endsWith('github-issues.runtime.issue558.test.ts')
const issue564AugmentedEnabled = issue564AugmentedEnvEnabled || e2eTargetFile.endsWith('github-issues.runtime.issue564.test.ts')
const issue615AugmentedEnabled = issue615AugmentedEnvEnabled || e2eTargetFile.endsWith('github-issues.runtime.issue615.test.ts')
const issue804WebRuntimeEnabled = e2eTargetFile.endsWith('github-issues.runtime.web-runtime.test.ts')
const githubIssuesWarmupRoutes = ['pages/block-slot/**']
const githubIssuesRouteGroups: Record<string, string[]> = {
  'github-issues.runtime.app-shell.test.ts': [
    'pages/issue-338/**',
    'pages/issue-448/**',
  ],
  'github-issues.runtime.issue448-formdata-upload.test.ts': [
    'pages/issue-448/**',
  ],
  'github-issues.runtime.import-meta.test.ts': [
    'pages/issue-431/**',
  ],
  'github-issues.runtime.issue289.test.ts': [
    'pages/issue-289/**',
  ],
  'github-issues.runtime.issue297-302.test.ts': [
    'pages/issue-297/**',
    'pages/issue-297-setup-method-calls/**',
    'pages/issue-302/**',
  ],
  'github-issues.runtime.issue466.test.ts': [
    'pages/issue-466/**',
    'subpackages/issue-466/**',
  ],
  'github-issues.runtime.issue553-555.test.ts': [
    'pages/issue-553/**',
    'pages/issue-555/**',
  ],
  'github-issues.runtime.issue547.test.ts': [
    'pages/issue-547/**',
  ],
  'github-issues.runtime.issue558.test.ts': [
    'pages/issue-558/**',
  ],
  'github-issues.runtime.issue554.test.ts': [
    'pages/issue-554/**',
  ],
  'github-issues.runtime.issue564.test.ts': [
    'pages/issue-564/**',
    'components/issue-564/**',
  ],
  'github-issues.runtime.issue615.test.ts': [
    'pages/issue-615/**',
  ],
  'github-issues.runtime.issue621.test.ts': [
    'pages/issue-621/**',
  ],
  'github-issues.runtime.issue627.test.ts': [
    'pages/issue-627-native/**',
  ],
  'github-issues.runtime.issue642.test.ts': [
    'pages/issue-642/**',
    'components/issue-642/**',
  ],
  'github-issues.runtime.issue642-bug7-default.test.ts': [
    'pages/issue-642-bug7/**',
  ],
  'github-issues.runtime.issue642-bug7-performance.test.ts': [
    'pages/issue-642-bug7/**',
  ],
  'github-issues.runtime.issue642-bug8.test.ts': [
    'pages/issue-642-bug8/**',
    'components/issue-642-bug8/**',
  ],
  'github-issues.runtime.issue674.test.ts': [
    'pages/issue-674/**',
    'components/issue-674/**',
  ],
  'github-issues.runtime.issue705.test.ts': [
    'pages/issue-550/**',
    'pages/issue-705/**',
    'pages/issue-705-tab/**',
    'custom-tab-bar/**',
  ],
  'github-issues.runtime.issue706.test.ts': [
    'pages/issue-706/**',
  ],
  'github-issues.runtime.issue829.test.ts': [
    'pages/issue-829/**',
    'components/issue-829/**',
  ],
  'github-issues.runtime.issue852.test.ts': [
    'pages/issue-852/**',
  ],
  'github-issues.runtime.issue826.test.ts': [
    'pages/issue-826/**',
    'issue-fixtures/issue-826/**',
  ],
  'github-issues.runtime.require-async.test.ts': [
    'pages/require-async/**',
    'subpackages/require-async/**',
  ],
  'github-issues.runtime.issue581.test.ts': [
    'pages/issue-581/**',
  ],
  'github-issues.runtime.lifecycle.test.ts': [
    'pages/block-slot/**',
    'pages/issue-289/**',
    'pages/issue-309/**',
    'pages/issue-309-created/**',
    'pages/issue-312/**',
    'pages/issue-316/**',
    'pages/issue-318/**',
    'pages/issue-320/**',
    'pages/issue-373/**',
    'pages/issue-380/**',
    'custom-tab-bar/**',
    'pages/issue-385/**',
    'pages/issue-398/**',
    'pages/issue-404/**',
    'pages/issue-418-419/**',
    'pages/issue-446/**',
    'pages/issue-479/**',
    'pages/issue-494/**',
    'pages/issue-500/**',
    'pages/issue-695/**',
    'pages/slot-flex-layout/**',
    'pages/slot-tag-form/**',
  ],
  'github-issues.runtime.miniprogram-computed.test.ts': [
    'subpackages/issue-466-computed/**',
  ],
  'github-issues.runtime.props.test.ts': [
    'pages/issue-300/**',
    'pages/issue-322/**',
    'pages/issue-328/**',
    'pages/issue-597/**',
    'pages/issue-613/**',
    'pages/issue-599/**',
    'pages/issue-600/**',
    'components/issue-597/**',
    'components/issue-613/**',
    'components/issue-599/**',
  ],
  'github-issues.runtime.subpackage-item.test.ts': [
    'subpackages/item/**',
    'subpackages/user/**',
  ],
  'github-issues.runtime.subpackage-user.test.ts': [
    'subpackages/item/**',
    'subpackages/user/**',
  ],
  'github-issues.runtime.slot-fallback.test.ts': [
    'pages/issue-520/**',
    'pages/issue-521/**',
    'pages/issue-528/**',
    'pages/issue-530/**',
    'pages/scoped-slot-outlet-fallback/**',
    'components/scoped-slot-outlet-fallback/**',
  ],
  'github-issues.runtime.slot-fallback-compiler-off.test.ts': [
    'pages/slot-fallback-compiler-off/**',
    'pages/slot-fallback-computed-error/**',
  ],
  'github-issues.runtime.web-runtime.test.ts': [
    'pages/issue-448/**',
    'pages/issue-459/**',
    'pages/issue-804/**',
    'components/issue-804/**',
  ],
}
for (const [aggregateTarget, testFiles] of Object.entries(githubIssuesAggregateTargets)) {
  githubIssuesRouteGroups[aggregateTarget] = [
    ...new Set(testFiles.flatMap(testFile => githubIssuesRouteGroups[testFile] ?? [])),
  ]
}
const matchedGithubIssuesTestFile = Object.keys(githubIssuesRouteGroups)
  .find(testFile => e2eTargetFile.endsWith(testFile))

function resolveGithubIssuesAutoRoutes() {
  if (issue850OutputReplayEnabled) {
    return {
      include: [
        'pages/issue-850/**',
        'subpackages/issue-850/**',
      ],
    }
  }
  if (issue845I18nEnabled) {
    return {
      include: [
        'pages/issue-845-native/**',
        'pages/issue-845-vue/**',
        'components/issue-845-i18n-card/**',
        'subpackages/issue-845-normal/**',
        'subpackages/issue-845-independent/**',
      ],
    }
  }
  if (issue826PreserveEnabled) {
    return {
      include: [
        'pages/issue-826/**',
      ],
    }
  }
  if (issue793BuildScopeEnabled) {
    return {
      include: [
        'pages/issue-793/**',
        'pages/issue-793-settings/**',
        'subs/issue-793/**',
      ],
    }
  }
  if (issue724ProbeEnabled) {
    return {
      include: [
        'pages/issue-724/**',
        'components/issue-724/**',
      ],
    }
  }
  if (issue510AugmentedEnabled) {
    return {
      include: [
        'pages/issue-510/**',
      ],
    }
  }
  if (issue547AugmentedEnvEnabled) {
    return {
      include: [
        'pages/issue-547/**',
      ],
    }
  }
  if (issue558AugmentedEnvEnabled) {
    return {
      include: [
        'pages/issue-558/**',
      ],
    }
  }
  if (issue564AugmentedEnvEnabled) {
    return {
      include: [
        'pages/issue-564/**',
        'components/issue-564/**',
      ],
    }
  }
  if (issue615AugmentedEnvEnabled) {
    return {
      include: [
        ...githubIssuesWarmupRoutes,
        'pages/issue-615/**',
      ],
    }
  }
  if (issue621AugmentedEnvEnabled) {
    return {
      include: [
        'pages/issue-621/**',
      ],
    }
  }
  if (slotFallbackCompilerOffEnabled) {
    return {
      include: [
        'pages/slot-fallback-compiler-off/**',
        'pages/slot-fallback-computed-error/**',
      ],
    }
  }

  const matchedRoutes = matchedGithubIssuesTestFile
    ? githubIssuesRouteGroups[matchedGithubIssuesTestFile]
    : undefined

  if (!matchedRoutes) {
    return true
  }

  if (matchedGithubIssuesTestFile === 'github-issues.runtime.issue627.test.ts') {
    return {
      include: matchedRoutes,
    }
  }

  return {
    include: [...new Set([...githubIssuesWarmupRoutes, ...matchedRoutes])],
  }
}

function resolveGithubIssuesNpm() {
  const tdesignDialogPackageFiles = {
    exclude: [
      '**/*.d.ts',
      '**/type.js',
      'common/shared/**',
    ],
    include: [
      'button/**',
      'common/**',
      'dialog/**',
      'icon/**',
      'loading/**',
      'miniprogram_npm/tslib/**',
      'mixins/**',
      'overlay/**',
      'popup/**',
    ],
  }
  const fullNpmConfig = {
    enable: true,
    packageFiles: {
      'tdesign-miniprogram': tdesignDialogPackageFiles,
    },
    mainPackage: {
      dependencies: [
        /^tdesign-miniprogram$/,
      ],
    },
    subPackages: {
      'subpackages/issue-327': {
        dependencies: [
          'dayjs',
          /^tdesign-miniprogram$/,
        ],
      },
      'subpackages/issue-466': {
        dependencies: [
          /^tdesign-miniprogram$/,
        ],
      },
      'subpackages/issue-466-computed': {
        dependencies: [
          'miniprogram-computed',
          /^tdesign-miniprogram$/,
        ],
      },
      'subpackages/item': {
        dependencies: [
          'camelcase',
        ],
      },
      'subpackages/user': {
        dependencies: [
          /^merge$/,
        ],
      },
    },
  }

  if (!matchedGithubIssuesTestFile) {
    return fullNpmConfig
  }

  if (matchedGithubIssuesTestFile === 'github-issues.runtime.issue466.test.ts') {
    return {
      mainPackage: fullNpmConfig.mainPackage,
      packageFiles: fullNpmConfig.packageFiles,
    }
  }

  if (matchedGithubIssuesTestFile === 'github-issues.runtime.miniprogram-computed.test.ts') {
    return {
      mainPackage: {
        dependencies: false,
      },
      packageFiles: fullNpmConfig.packageFiles,
      subPackages: {
        'subpackages/issue-466-computed': fullNpmConfig.subPackages['subpackages/issue-466-computed'],
      },
    }
  }

  if (matchedGithubIssuesTestFile === 'github-issues.runtime.props.test.ts') {
    return {
      mainPackage: {
        dependencies: false,
      },
    }
  }

  if (matchedGithubIssuesTestFile === 'github-issues.runtime.subpackage-item.test.ts') {
    return {
      mainPackage: {
        dependencies: false,
      },
      subPackages: {
        'subpackages/item': fullNpmConfig.subPackages['subpackages/item'],
        'subpackages/user': fullNpmConfig.subPackages['subpackages/user'],
      },
    }
  }

  if (matchedGithubIssuesTestFile === 'github-issues.runtime.subpackage-user.test.ts') {
    return {
      mainPackage: {
        dependencies: false,
      },
      subPackages: {
        'subpackages/item': fullNpmConfig.subPackages['subpackages/item'],
        'subpackages/user': fullNpmConfig.subPackages['subpackages/user'],
      },
    }
  }

  if (matchedGithubIssuesTestFile === 'github-issues.runtime.aggregate.test.ts') {
    return fullNpmConfig
  }

  return {
    enable: false,
  }
}

const issue724ProbePlugins = issue724ProbeEnabled
  ? [
      {
        name: 'github-issues:issue-724-style-load-probe',
        enforce: 'pre' as const,
        transform(code: string, id: string) {
          const normalizedId = id.replaceAll('\\', '/')
          if (!normalizedId.includes('/issue-724/') || !id.includes('?weapp-vite-vue&type=style')) {
            return null
          }
          if (/<(?:template|script|style)(?:\s|>)/.test(code)) {
            throw new Error(`issue #724 style request leaked another SFC block: ${normalizedId}`)
          }
          return null
        },
      },
      {
        name: 'github-issues:issue-724-post-transform-probe',
        enforce: 'post' as const,
        transform(code: string, id: string) {
          const normalizedId = id.replaceAll('\\', '/')
          if (!normalizedId.includes('/issue-724/') || !normalizedId.endsWith('.vue')) {
            return null
          }
          if (/<(?:template|script|style)(?:\s|>)/.test(code)) {
            throw new Error(`issue #724 downstream JS received a raw SFC: ${normalizedId}`)
          }
          return null
        },
      },
    ]
  : []

const issue779CssPrePlugin = issue779CssPreEnabled
  ? [
      {
        name: 'github-issues:issue-779-css-pre',
        enforce: 'pre' as const,
        transform(_code: string, id: string) {
          const normalizedId = id.replaceAll('\\', '/')
          if (!normalizedId.includes('/src/pages/issue-779/') || !id.includes('weapp-vite-sidecar=style')) {
            return null
          }
          return `@import "tailwindcss";\n.issue-779-pre-marker { color: rgb(1, 2, 3); }`
        },
      },
      {
        name: 'github-issues:issue-779-css-pipeline-probe',
        transform(code: string, id: string) {
          const normalizedId = id.replaceAll('\\', '/')
          if (!normalizedId.includes('/src/pages/issue-779/') || !id.includes('weapp-vite-sidecar=style')) {
            return null
          }
          if (
            !code.includes('.issue-779-pre-marker')
            || code.includes('.issue-779-disk-marker')
          ) {
            throw new Error(`issue #779 Tailwind pipeline did not preserve the pre-transformed CSS: ${normalizedId}`)
          }
          return null
        },
      },
    ]
  : undefined

const issue850OutputMarker = '/* issue-850-output-marker */'
const issue850OutputReplayPlugin = issue850OutputReplayEnabled
  ? {
      name: 'github-issues:issue-850-output-replay',
      enforce: 'post' as const,
      generateBundle: {
        order: 'post' as const,
        handler(_options: unknown, bundle: OutputBundle) {
          const output = bundle['subpackages/issue-850/index.wxss']
          if (output?.type !== 'asset') {
            return
          }
          output.source = `${String(output.source)}\n${issue850OutputMarker}`
        },
      },
    }
  : undefined

const devtoolsRuntimeSubpackageRoot = e2eTargetFile.endsWith('github-issues.runtime.subpackage-item.test.ts')
  ? 'subpackages/item'
  : e2eTargetFile.endsWith('github-issues.runtime.subpackage-user.test.ts')
    ? 'subpackages/user'
    : undefined
const devtoolsSingleSubpackagePlugin = devtoolsRuntimeSubpackageRoot
  ? {
      name: 'github-issues:devtools-single-runtime-subpackage',
      enforce: 'post' as const,
      generateBundle: {
        order: 'post' as const,
        handler(_options: unknown, bundle: OutputBundle) {
          const output = bundle['app.json']
          if (output?.type !== 'asset') {
            throw new Error('DevTools single-subpackage build did not emit app.json')
          }

          const source = typeof output.source === 'string'
            ? output.source
            : Buffer.from(output.source).toString('utf8')
          const config = JSON.parse(source) as Record<string, unknown>
          if (!Array.isArray(config.subPackages)) {
            throw new TypeError('DevTools single-subpackage app.json did not emit subPackages')
          }

          config.subPackages = config.subPackages.filter((subPackage) => {
            return subPackage
              && typeof subPackage === 'object'
              && 'root' in subPackage
              && subPackage.root === devtoolsRuntimeSubpackageRoot
          })
          output.source = `${JSON.stringify(config, null, 2)}\n`
        },
      },
    }
  : undefined

function resolveGithubIssuesBuildConfig() {
  if (issue850OutputReplayEnabled) {
    return { outDir: 'dist-issue-850', minify: false }
  }
  if (issue845I18nEnabled) {
    return { outDir: 'dist-issue-845', minify: false }
  }
  if (issue826PreserveEnabled) {
    return {
      outDir: process.env.WEAPP_GITHUB_ISSUE_826_OUT_DIR ?? 'dist-issue-826',
      minify: false,
    }
  }
  if (issue393ChunkModeEnabled) {
    return { outDir: 'dist-issue-393', minify: false }
  }
  if (issue793BuildScopeEnabled) {
    return { outDir: 'dist-issue-793' }
  }
  if (issue724ProbeEnabled) {
    return { outDir: 'dist-issue-724' }
  }
  if (issue510AugmentedEnabled) {
    return { outDir: 'dist-issue-510' }
  }
  if (slotFallbackCompilerOffEnabled) {
    return { outDir: 'dist-slot-fallback-compiler-off' }
  }
  if (issue595ScopedBuildEnabled) {
    return { outDir: 'dist-issue-595' }
  }
  if (issue642ScopedBuildEnabled) {
    return { outDir: 'dist-issue-642' }
  }
  if (issue779CssPreEnabled) {
    return { outDir: 'dist-issue-779' }
  }
  return undefined
}

const githubIssuesBuildConfig = resolveGithubIssuesBuildConfig()

export default defineConfig({
  plugins: [
    ...issue724ProbePlugins,
    ...(issue779CssPrePlugin ?? []),
    ...(issue850OutputReplayPlugin ? [issue850OutputReplayPlugin] : []),
    ...(devtoolsSingleSubpackagePlugin ? [devtoolsSingleSubpackagePlugin] : []),
  ],
  define: {
    'import.meta.env.ISSUE_484_FLAG': '123456',
  },
  weapp: {
    ...(issue845I18nEnabled
      ? {
          i18n: {
            defaultLocale: 'zh-CN',
            fallbackLocale: 'en-US',
          },
        }
      : {}),
    hmr: {
      logLevel: 'verbose',
      profileJson: true,
    },
    srcRoot: 'src',
    autoRoutes: resolveGithubIssuesAutoRoutes(),
    subPackages: issue850OutputReplayEnabled
      ? {
          'subpackages/issue-850': {
            independent: true,
          },
        }
      : issue845I18nEnabled
        ? {
            'subpackages/issue-845-normal': {},
            'subpackages/issue-845-independent': {
              independent: true,
            },
          }
        : issue793BuildScopeEnabled
          ? {
              subs: {},
            }
          : {
              'subpackages/require-async': {},
            },
    ...(issue793BuildScopeEnabled
      ? {
          buildScope: {
            ...(issue793BuildScope === 'subpackage'
              ? { includeMainPackage: false }
              : {}),
            include: issue793BuildScope === 'subpackage'
              ? ['subs']
              : ['pages', ...(issue793BuildScope === 'main-with-subpackage' ? ['subs'] : [])],
          },
        }
      : {}),
    typescript: {
      app: {
        compilerOptions: {
          paths: {
            'tdesign-miniprogram/*': [
              './node_modules/tdesign-miniprogram/miniprogram_dist/*',
            ],
          },
        },
      },
    },
    wevu: {
      ...(issue642Bug7PerformanceEnabled
        ? { preset: 'performance' as const }
        : issue642Bug7DefaultEnabled
          ? { autoSetDataPick: false }
          : { autoSetDataPick: true }),
    },
    autoImportComponents: {
      resolvers: [
        {
          components: {
            Issue520ResolverSlotCard: '/components/issue-520/ResolverSlotCard/index',
            Issue724RoutingProbe: '/components/issue-724/RoutingProbe/index',
          },
        },
        {
          resolve(componentName) {
            if (componentName === 'Issue651ResolverNoExt') {
              return {
                name: componentName,
                from: '/issue-fixtures/issue-651/ResolverNoExt/index',
                resolvedId: issue651NoExtResolvedId,
              }
            }
            if (componentName === 'Issue651ResolverWithExt') {
              return {
                name: componentName,
                from: '/issue-fixtures/issue-651/ResolverWithExt/index',
                resolvedId: issue651WithExtResolvedId,
              }
            }
          },
        },
      ],
    },
    vue: {
      template: {
        slotSingleRootNoWrapper: true,
        ...(slotFallbackCompilerOffEnabled
          ? {
              scopedSlotsCompiler: 'off',
            } as const
          : issue510AugmentedEnabled || issue547AugmentedEnabled || issue558AugmentedEnabled || issue564AugmentedEnabled || issue615AugmentedEnabled
            ? {
                scopedSlotsCompiler: 'augmented',
                scopedSlotsRequireProps: false,
              } as const
            : {}),
      },
    },
    npm: resolveGithubIssuesNpm(),
    ...(issue804WebRuntimeEnabled
      ? {
          appPrelude: {
            webRuntime: true,
          },
        }
      : {}),
    chunks: {
      ...(issue826PreserveEnabled
        ? {
            preserveModules: [
              'issue-fixtures/issue-826/utils/**',
              'issue-fixtures/issue-826/services/**',
            ],
          }
        : {}),
      dynamicImports: issue393ChunkModeEnabled ? 'preserve' : 'native',
      ...(issue393ChunkModeEnabled
        ? {
            sharedStrategy: 'duplicate',
            sharedMode: 'common',
            sharedPathRoot: 'src',
            sharedOverrides: [
              {
                test: /(?:^|\/)debounce(?:\/|$)/,
                mode: 'path',
              },
            ],
          }
        : {}),
    },
  },
  ...(githubIssuesBuildConfig
    ? { build: githubIssuesBuildConfig }
    : {}),
})
