import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { UnifiedViteWeappTailwindcssPlugin as uvwt } from 'weapp-tailwindcss/vite'
import { defineConfig } from 'weapp-vite/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    uvwt({
      rem2rpx: true,
    }),
  ],
  resolve: {
    alias: {
      '@vant/weapp/common/index.css': path.resolve(__dirname, './node_modules/@vant/weapp/dist/common/index.wxss'),
    },
  },
  weapp: {
    debug: {
      inspect: {
        threshold: 100,
        slient: true,
        onHookExecution({ hookName, pluginName, duration, args }) {
          console.log(`[${pluginName}] ${hookName.padEnd(20)} ⏱ ${duration.toFixed(2).padStart(6)} ms`)
          if (hookName === 'transform') {
            console.log(args[1])
          }
          else if (hookName === 'load') {
            console.log(args[0])
          }
        },
      },
    },
  },
})
