import { wevuPlugin } from '@weapp-vite/plugin-wevu'
import { defineConfig } from 'weapp-vite/config'

export default defineConfig(() => ({
  weapp: {
    srcRoot: 'src',  // 直接使用 src 目录
  },
  plugins: [
    wevuPlugin({
      include: ['src'],  // 扫描 src 目录，就地编译（不设置 outputRoot）
    }),
  ],
}))
