import { defineConfig } from 'weapp-vite/config'
import { VantResolver } from 'weapp-vite/auto-import-components/resolvers'
import path from 'pathe'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    generate: {
      extensions: {
        js: 'ts',
        wxss: 'scss',
      },
      dirs: {
        component: 'src/components',
        page: 'src/pages',
      },
    },
    enhance: {
      autoImportComponents: {
        globs: ['components/**/*'],
        resolvers: [
          VantResolver()
        ]
      }
    },
    jsonAlias: {
      entries: [
        {
          find: '@',
          replacement: path.resolve(import.meta.dirname, 'src/components'),
        },
      ],
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['legacy-js-api', 'import'],
      },
    },
  },
  plugins: [
  ],
})
