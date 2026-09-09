import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    tailwindcss: {
      rem2rpx: true,
      cssEntries: ['tailwind.css'],
    },
    hmr: {
      logLevel: 'verbose',
      profileJson: true,
    },
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
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
})
