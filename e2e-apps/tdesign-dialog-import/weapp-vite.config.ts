import path from 'node:path'
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    hmr: {
      logLevel: 'verbose',
      profileJson: true,
    },
    srcRoot: 'src',
    npm: {
      subPackages: {
        customized: { dependencies: ['tdesign-miniprogram'] },
      },
      buildOptions(options, { name }) {
        const outDir = options.build?.outDir
        if (name === 'tdesign-miniprogram' && outDir?.replaceAll('\\', '/').endsWith('/customized/miniprogram_npm/tdesign-miniprogram')) {
          return {
            ...options,
            build: {
              ...options.build,
              outDir: path.resolve(outDir, '../../custom-components/tdesign-miniprogram'),
            },
          }
        }
        return options
      },
    },
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
  },
})
