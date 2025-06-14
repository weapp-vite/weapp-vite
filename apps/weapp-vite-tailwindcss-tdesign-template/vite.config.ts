import { UnifiedViteWeappTailwindcssPlugin } from 'weapp-tailwindcss/vite'
import { TDesignResolver } from 'weapp-vite/auto-import-components/resolvers'
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    enhance: {
      autoImportComponents: {
        resolvers: [TDesignResolver()],
      },
    },
    // pnpm g 生成的格式
    // https://vite.icebreaker.top/guide/generate.html
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
  plugins: [
    UnifiedViteWeappTailwindcssPlugin({
      rem2rpx: true,
    }),
  ],
})
