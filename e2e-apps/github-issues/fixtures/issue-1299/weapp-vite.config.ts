import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  build: { target: 'es2019' },
  weapp: {
    srcRoot: 'src',
    vue: {
      template: { nativeSlotContext: true, scopedSlotsRequireProps: true },
    },
  },
})
