import path from 'node:path'
import { defineConfig } from 'weapp-vite/config'

const issue327OwnerRoot = path.resolve(import.meta.dirname, 'dist/subpackages/issue-327/miniprogram_npm')
const issue327OwnedDependencies = new Set([
  'dayjs',
  'tdesign-miniprogram',
])

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    wevu: {
      autoSetDataPick: true,
    },
    npm: {
      buildOptions(options, pkgMeta) {
        if (!issue327OwnedDependencies.has(pkgMeta.name)) {
          return options
        }

        return {
          ...options,
          build: {
            ...options.build,
            outDir: path.resolve(issue327OwnerRoot, pkgMeta.name),
          },
        }
      },
    },
  },
})
