import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { defineConfig } from 'weapp-vite'

const watchedOutputSuffix = '/dist/miniprogram_npm/@vant/weapp/field/index.json'
const watchProbeMarker = path.resolve('.tmp/issue-862-output-watched')

export default defineConfig({
  plugins: [
    {
      name: 'github-issues:issue-862-output-watch-probe',
      async hotUpdate({ file }) {
        const normalizedFile = file.replaceAll('\\', '/')
        if (normalizedFile.endsWith(watchedOutputSuffix)) {
          await mkdir(path.dirname(watchProbeMarker), { recursive: true })
          await writeFile(watchProbeMarker, normalizedFile, 'utf8')
        }
      },
    },
  ],
  weapp: {
    autoImportComponents: false,
    autoRoutes: {
      include: ['pages/issue-862/**'],
    },
    hmr: {
      runtime: 'classic',
    },
    srcRoot: 'src/issue-fixtures/issue-862',
  },
})
