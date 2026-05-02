import process from 'node:process'
import { defineConfig } from 'weapp-vite'

const issue393ChunkModeEnabled = process.env.WEAPP_GITHUB_ISSUE_393 === 'true'
const e2eTargetFile = process.env.WEAPP_VITE_E2E_TARGET_FILE?.replaceAll('\\', '/') ?? ''
const githubIssuesWarmupRoutes = ['pages/block-slot/**']
const githubIssuesRouteGroups: Record<string, string[]> = {
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
  'github-issues.runtime.web-runtime.test.ts': [
    'pages/issue-448/**',
    'pages/issue-459/**',
  ],
}
const matchedGithubIssuesTestFile = Object.keys(githubIssuesRouteGroups)
  .find(testFile => e2eTargetFile.endsWith(testFile))

function resolveGithubIssuesAutoRoutes() {
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
    : {}),
})
