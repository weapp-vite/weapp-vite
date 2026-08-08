import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    react: {
      renderMode: 'auto',
      compiler: false,
    },
  },
})
