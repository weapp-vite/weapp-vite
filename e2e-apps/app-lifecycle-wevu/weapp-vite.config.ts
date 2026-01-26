import { defineConfig } from 'weapp-vite/config'

export default defineConfig(({ mode }) => ({
  weapp: {
    srcRoot: mode === 'vue' ? 'src-vue' : 'src-ts',
  },
}))
