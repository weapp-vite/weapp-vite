import process from 'node:process'
import { defineConfig } from 'weapp-vite'

const issue393ChunkModeEnabled = process.env.WEAPP_GITHUB_ISSUE_393 === 'true'

export default defineConfig({
  define: {
    'import.meta.env.ISSUE_484_FLAG': '123456',
  },
  weapp: {
    srcRoot: 'src',
    autoRoutes: true,
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
    npm: {
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
    },
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
