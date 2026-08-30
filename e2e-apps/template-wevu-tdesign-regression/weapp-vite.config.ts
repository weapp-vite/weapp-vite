import path from 'node:path'
import { defineConfig } from 'weapp-vite'
import { TDesignResolver } from 'weapp-vite/auto-import-components/resolvers'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  build: {
    rolldownOptions: {
      checks: {
        pluginTimings: false,
      },
    },
  },
  weapp: {
    tailwindcss: {
      rem2rpx: true,
      cssEntries: ['src/app.css'],
    },
    hmr: {
      logLevel: 'verbose',
      profileJson: true,
    },
    srcRoot: 'src',
    typescript: {
      app: {
        compilerOptions: {
          paths: {
            'tdesign-miniprogram/*': ['../../node_modules/tdesign-miniprogram/miniprogram_dist/*'],
          },
        },
      },
    },
    autoRoutes: true,
    autoImportComponents: {
      resolvers: [TDesignResolver()],
      htmlCustomData: true,
      typedComponents: true,
      vueComponents: true,
      vueComponentsModule: 'wevu',
    },
    wevu: {
      defaults: {
        component: {
          options: {
            virtualHost: true,
            styleIsolation: 'apply-shared',
          },
        },
      },
    },
    // pnpm g 生成的格式
    // https://vite.weapp.dev/guide/generate.html
    generate: {
      extensions: {
        js: 'ts',
        wxss: 'scss',
      },
      dirs: {
        component: 'src/components',
        page: 'src/pages',
      },
      // 假如你想让默认生成的组件命名为 Foo/index 而不是 Foo/Foo 可以下列选项
      // filenames: {
      //   component: 'index',
      //   page: 'index',
      // },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['legacy-js-api', 'import'],
      },
    },
  },
})
