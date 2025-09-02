import { defineConfig } from 'weapp-vite/config'
import path from 'path'
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
        independent: true,
        inlineConfig: {
          define:{
            'import.meta.env.VITE_SUB_PACKAGE_B': '"sub-package-b"'
          }
        }
        // configFile:  './vite.packageB.config.ts' // path.resolve(import.meta.dirname, './vite.packageB.config.ts')
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
