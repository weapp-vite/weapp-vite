import type { Plugin } from 'vite'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { transformWithOxc } from 'vite'
import { defineConfig } from 'weapp-vite'

const REACT_PAGE_ID = 'virtual:react-runtime-spike-page'
const RESOLVED_REACT_PAGE_ID = '\0react-runtime-spike-page'
const REACT_PAGE_FILENAME = path.resolve(import.meta.dirname, 'src/pages/index/view.tsx')

function reactSpikeJsxPlugin(): Plugin {
  return {
    name: 'react-runtime-spike:jsx',
    enforce: 'pre',
    async resolveId(id, importer) {
      if (id === REACT_PAGE_ID) {
        return RESOLVED_REACT_PAGE_ID
      }
      if (importer === RESOLVED_REACT_PAGE_ID && id.startsWith('.')) {
        return await this.resolve(id, REACT_PAGE_FILENAME, { skipSelf: true })
      }
      return null
    },
    async load(id) {
      if (id !== RESOLVED_REACT_PAGE_ID) {
        return null
      }

      this.addWatchFile(REACT_PAGE_FILENAME)
      const source = await readFile(REACT_PAGE_FILENAME, 'utf8')
      return await transformWithOxc(source, REACT_PAGE_FILENAME, {
        jsx: {
          importSource: 'react',
          runtime: 'automatic',
        },
        lang: 'tsx',
        sourcemap: true,
      })
    },
  }
}

export default defineConfig({
  build: {
    minify: true,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  plugins: [reactSpikeJsxPlugin()],
  weapp: {
    srcRoot: 'src',
  },
})
