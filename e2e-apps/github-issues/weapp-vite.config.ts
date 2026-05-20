import process from 'node:process'
import { defineConfig } from 'weapp-vite'

const issue393ChunkModeEnabled = process.env.WEAPP_GITHUB_ISSUE_393 === 'true'
const issue510AugmentedEnabled = process.env.WEAPP_GITHUB_ISSUE_510_AUGMENTED === 'true'
const issue547AugmentedEnvEnabled = process.env.WEAPP_GITHUB_ISSUE_547_AUGMENTED === 'true'
const issue558AugmentedEnvEnabled = process.env.WEAPP_GITHUB_ISSUE_558_AUGMENTED === 'true'
const issue564AugmentedEnvEnabled = process.env.WEAPP_GITHUB_ISSUE_564_AUGMENTED === 'true'
const issue595ScopedBuildEnabled = process.env.WEAPP_GITHUB_ISSUE_595_SCOPED === 'true'
const e2eTargetFile = process.env.WEAPP_VITE_E2E_TARGET_FILE?.replaceAll('\\', '/') ?? ''
const slotFallbackCompilerOffEnabled = process.env.WEAPP_GITHUB_SLOT_FALLBACK_COMPILER_OFF === 'true'
  || e2eTargetFile.endsWith('github-issues.runtime.slot-fallback-compiler-off.test.ts')
const issue547AugmentedEnabled = issue547AugmentedEnvEnabled || e2eTargetFile.endsWith('github-issues.runtime.issue547.test.ts')
const issue558AugmentedEnabled = issue558AugmentedEnvEnabled || e2eTargetFile.endsWith('github-issues.runtime.issue558.test.ts')
const issue564AugmentedEnabled = issue564AugmentedEnvEnabled || e2eTargetFile.endsWith('github-issues.runtime.issue564.test.ts')
const githubIssuesWarmupRoutes = ['pages/block-slot/**']
const githubIssuesRouteGroups: Record<string, string[]> = {
  'github-issues.runtime.app-shell.test.ts': [
    'pages/issue-338/**',
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
  'github-issues.runtime.issue547.test.ts': [
    'pages/issue-547/**',
  ],
  'github-issues.runtime.issue558.test.ts': [
    'pages/issue-558/**',
    'components/issue-558/**',
  ],
  'github-issues.runtime.issue554.test.ts': [
    'pages/issue-554/**',
  ],
  'github-issues.runtime.issue564.test.ts': [
    'pages/issue-564/**',
    'components/issue-564/**',
  ],
  'github-issues.runtime.issue581.test.ts': [
    'pages/issue-581/**',
  ],
  'github-issues.runtime.lifecycle.test.ts': [
    'pages/issue-289/**',
    'pages/issue-309/**',
    'pages/issue-309-created/**',
    'pages/issue-312/**',
    'pages/issue-316/**',
    'pages/issue-318/**',
    'pages/issue-320/**',
    'pages/issue-373/**',
    'pages/issue-380/**',
    'pages/issue-385/**',
    'pages/issue-398/**',
    'pages/issue-404/**',
    'pages/issue-418-419/**',
    'pages/issue-446/**',
    'pages/issue-479/**',
    'pages/issue-494/**',
    'pages/issue-500/**',
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
    'subpackages/item/**',
    'subpackages/user/**',
  ],
  'github-issues.runtime.slot-fallback.test.ts': [
    'pages/issue-520/**',
    'pages/issue-521/**',
    'pages/issue-528/**',
    'pages/issue-530/**',
  ],
  'github-issues.runtime.slot-fallback-compiler-off.test.ts': [
    'pages/slot-fallback-compiler-off/**',
    'pages/slot-fallback-computed-error/**',
  ],
  'github-issues.runtime.web-runtime.test.ts': [
    'pages/issue-448/**',
    'pages/issue-459/**',
  ],
}
const matchedGithubIssuesTestFile = Object.keys(githubIssuesRouteGroups)
  .find(testFile => e2eTargetFile.endsWith(testFile))

function resolveGithubIssuesAutoRoutes() {
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
        'components/issue-558/**',
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

  return {
    include: [...new Set([...githubIssuesWarmupRoutes, ...matchedRoutes])],
  }
}

function resolveGithubIssuesNpm() {
  const fullNpmConfig = {
    enable: true,
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
      subPackages: {
        'subpackages/issue-466': fullNpmConfig.subPackages['subpackages/issue-466'],
      },
    }
  }

  if (matchedGithubIssuesTestFile === 'github-issues.runtime.miniprogram-computed.test.ts') {
    return {
      subPackages: {
        'subpackages/issue-466-computed': fullNpmConfig.subPackages['subpackages/issue-466-computed'],
      },
    }
  }

  if (matchedGithubIssuesTestFile === 'github-issues.runtime.props.test.ts') {
    return {
      subPackages: {
        'subpackages/item': fullNpmConfig.subPackages['subpackages/item'],
        'subpackages/user': fullNpmConfig.subPackages['subpackages/user'],
      },
    }
  }

  return {
    enable: false,
  }
}

export default defineConfig({
  define: {
    'import.meta.env.ISSUE_484_FLAG': '123456',
  },
  weapp: {
    hmr: {
      logLevel: 'verbose',
      profileJson: true,
    },
    srcRoot: 'src',
    autoRoutes: resolveGithubIssuesAutoRoutes(),
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
      autoSetDataPick: true,
    },
    autoImportComponents: {
      resolvers: [
        {
          components: {
            Issue520ResolverSlotCard: '/components/issue-520/ResolverSlotCard/index',
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
          : issue510AugmentedEnabled || issue547AugmentedEnabled || issue558AugmentedEnabled || issue564AugmentedEnabled
            ? {
                scopedSlotsCompiler: 'augmented',
                scopedSlotsRequireProps: false,
              } as const
            : {}),
      },
    },
    npm: resolveGithubIssuesNpm(),
    ...(issue393ChunkModeEnabled
      ? {
          chunks: {
            sharedStrategy: 'duplicate',
            sharedMode: 'common',
            sharedPathRoot: 'src',
            dynamicImports: 'preserve',
            sharedOverrides: [
              {
                test: /(?:^|\/)debounce(?:\/|$)/,
                mode: 'path',
              },
            ],
          },
        }
      : {}),
  },
  ...(issue393ChunkModeEnabled
    ? {
        build: {
          outDir: 'dist-issue-393',
          minify: false,
        },
      }
    : issue510AugmentedEnabled
      ? {
          build: {
            outDir: 'dist-issue-510',
          },
        }
      : slotFallbackCompilerOffEnabled
        ? {
            build: {
              outDir: 'dist-slot-fallback-compiler-off',
            },
          }
        : issue595ScopedBuildEnabled
          ? {
              build: {
                outDir: 'dist-issue-595',
              },
            }
          : {}),
})
