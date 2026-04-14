import { defineConfig } from 'weapp-vite'

export default defineConfig({
  define: {
    __FROM_VITE_CONFIG__: JSON.stringify('vite'),
  },
  build: {
    sourcemap: true,
  },
  weapp: {
    srcRoot: 'src-from-vite',
    enhance: {
      wxs: false,
    },
    npm: {
      enable: false,
    },
  },
})
