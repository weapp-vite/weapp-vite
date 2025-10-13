import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    autoRoutes: true,
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
    copy: {
      include: ['**/*.fuck', '**/*.bitch'],
      exclude: ['**/*.br']
    },
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
