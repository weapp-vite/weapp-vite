import { defineConfig } from 'weapp-vite/config'
import { wevuPlugin } from '@weapp-vite/plugin-wevu'

export default defineConfig(() => ({
  weapp: {
    srcRoot: '.wevu/src',
  },
  plugins: [
    wevuPlugin({
      include: ['src'],
      outputRoot: '.wevu',
    }),
  ],
}))
