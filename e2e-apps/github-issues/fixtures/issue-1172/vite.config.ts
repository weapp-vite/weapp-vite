import { defineConfig } from 'weapp-vite'

export default defineConfig({
  // 真机调试上传前由 Vite 降级可选链，避免依赖 IDE 的增强编译。
  build: { target: 'es2019' },
  weapp: {
    srcRoot: 'src',
    vue: { template: { scopedSlotsRequireProps: true } },
  },
})
