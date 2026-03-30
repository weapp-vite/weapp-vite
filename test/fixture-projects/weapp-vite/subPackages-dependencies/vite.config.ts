import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    npm: {
      subPackages: {
        packageB: {
          dependencies: [
            'class-variance-authority',
            'buffer',
            'gm-crypto',
          ],
        },
      },
    },
    generate: {
      extensions: {
        js: 'ts',
        wxss: 'scss',
      },
      dirs: {
        component: 'src/components',
        page: 'src/pages',
      },
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
