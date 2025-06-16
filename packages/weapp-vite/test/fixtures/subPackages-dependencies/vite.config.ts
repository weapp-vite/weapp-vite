import { defineConfig } from 'weapp-vite/config'

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
    subPackages: {
      packageB: {
        dependencies: [
          'class-variance-authority',
          'buffer',
          'gm-crypto'
        ]
      }
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
    {
      name: 'test-plugin',
      watchChange(id, change) {
        console.log('watchChange', id, change)
      },
    }
  ],
})
