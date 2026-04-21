import { weappTailwindcss } from 'weapp-tailwindcss/vite'
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    // weapp-vite options
    typescript: {
      app: {
        compilerOptions: {
          noImplicitAny: false,
          paths: {
            '@/*': ['./*'],
            'tdesign-miniprogram/*': ['./node_modules/tdesign-miniprogram/miniprogram_dist/*'],
          },
        },
      },
    },
  },
  plugins: [
    weappTailwindcss(
      {
        rem2rpx: true,
      },
    ),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
})
