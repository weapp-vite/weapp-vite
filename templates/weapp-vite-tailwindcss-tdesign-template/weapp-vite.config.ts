import { defineConfig } from 'weapp-vite'
import { TDesignResolver } from 'weapp-vite/auto-import-components/resolvers'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    tailwindcss: {
      rem2rpx: true,
      cssEntries: ['src/app.css'],
    },
    typescript: {
      app: {
        compilerOptions: {
          paths: {
            'tdesign-miniprogram/*': ['./node_modules/tdesign-miniprogram/miniprogram_dist/*'],
          },
        },
      },
    },
    autoImportComponents: {
      resolvers: [TDesignResolver()],
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
      // 假如你想让默认生成的组件命名为 HelloWorld/index 而不是 HelloWorld/HelloWorld 可以下列选项
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
