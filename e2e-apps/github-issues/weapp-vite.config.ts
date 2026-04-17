import process from 'node:process'
import { defineConfig } from 'weapp-vite'

const issue393ChunkModeEnabled = process.env.WEAPP_GITHUB_ISSUE_393 === 'true'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    autoRoutes: true,
    wevu: {
      autoSetDataPick: true,
    },
    npm: {
      mainPackage: {
        dependencies: false,
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
