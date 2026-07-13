import type { Plugin } from 'vite'
import type { ReactTransformMode } from './config/reactTransform.ts'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { defineConfig } from 'weapp-vite'
import { transformReactTsx } from './config/reactTransform.ts'
import { compileStaticReactPage } from './config/staticTemplate/index.ts'

const REACT_PAGE_ID = 'virtual:react-runtime-spike-page'
const RESOLVED_REACT_PAGE_ID = '\0react-runtime-spike-page'
const REACT_PAGE_FILENAME = path.resolve(import.meta.dirname, 'src/pages/index/view.tsx')
const STATIC_PAGE_ID = 'virtual:react-static-binding-spike-page'
const RESOLVED_STATIC_PAGE_ID = '\0react-static-binding-spike-page'
const STATIC_PAGE_FILENAME = path.resolve(import.meta.dirname, 'src/pages/static/view.tsx')
const STATIC_WXML_FILE = 'pages/static/index.wxml'

function reactSpikeJsxPlugin(transformMode: ReactTransformMode): Plugin {
  let staticTemplate: string | undefined

  return {
    name: 'react-runtime-spike:jsx',
    enforce: 'pre',
    buildStart() {
      staticTemplate = undefined
    },
    async resolveId(id, importer) {
      if (id === REACT_PAGE_ID) {
        return RESOLVED_REACT_PAGE_ID
      }
      if (id === STATIC_PAGE_ID) {
        return RESOLVED_STATIC_PAGE_ID
      }
      const importerFilename = importer === RESOLVED_REACT_PAGE_ID
        ? REACT_PAGE_FILENAME
        : importer === RESOLVED_STATIC_PAGE_ID
          ? STATIC_PAGE_FILENAME
          : undefined
      if (importerFilename && id.startsWith('.')) {
        return await this.resolve(id, importerFilename, { skipSelf: true })
      }
      return null
    },
    async load(id) {
      if (id === RESOLVED_REACT_PAGE_ID) {
        this.addWatchFile(REACT_PAGE_FILENAME)
        const source = await readFile(REACT_PAGE_FILENAME, 'utf8')
        return await transformReactTsx(source, REACT_PAGE_FILENAME, transformMode)
      }
      if (id !== RESOLVED_STATIC_PAGE_ID) {
        return null
      }

      this.addWatchFile(STATIC_PAGE_FILENAME)
      const source = await readFile(STATIC_PAGE_FILENAME, 'utf8')
      const compiled = compileStaticReactPage(source, STATIC_PAGE_FILENAME)
      staticTemplate = compiled.template
      return await transformReactTsx(compiled.code, STATIC_PAGE_FILENAME, transformMode)
    },
    generateBundle(_options, bundle) {
      if (!staticTemplate) {
        return
      }
      const existing = bundle[STATIC_WXML_FILE]
      if (existing?.type === 'asset') {
        existing.source = staticTemplate
        return
      }
      this.emitFile({
        fileName: STATIC_WXML_FILE,
        source: staticTemplate,
        type: 'asset',
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const transformMode: ReactTransformMode = mode === 'baseline' ? 'oxc' : 'swc-react-compiler'

  return {
    build: {
      minify: true,
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    plugins: [reactSpikeJsxPlugin(transformMode)],
    weapp: {
      srcRoot: 'src',
    },
  }
})
