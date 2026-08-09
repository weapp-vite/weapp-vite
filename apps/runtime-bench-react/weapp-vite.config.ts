import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  build: {
    minify: true,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  weapp: {
    react: {
      compiler: false,
      renderMode: 'auto',
    },
    srcRoot: 'src',
  },
})
