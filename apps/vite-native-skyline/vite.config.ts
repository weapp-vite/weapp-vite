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
