import { appendFile } from 'node:fs/promises'
import { unwatchFile, watchFile } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { defineConfig } from 'weapp-vite'

if (!process.versions.bun) {
  throw new Error('issue #1222 must execute the CLI in Bun')
}
process.stdout.write(`BUN_RUNTIME ${JSON.stringify({ version: process.versions.bun, connected: process.connected, ipc: typeof process.send === 'function', pid: process.pid })}\n`)
const shutdownRequest = path.join(process.cwd(), 'shutdown-request')
if (process.argv.includes('dev') && process.platform === 'win32') {
  // Windows 不派发可捕获的 POSIX 信号；文件请求进入相同的信号处理边界。
  watchFile(shutdownRequest, { interval: 50 }, (stat) => {
    if (stat.mtimeMs > 0) {
      unwatchFile(shutdownRequest)
      process.emit('SIGTERM')
    }
  })
}

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    autoRoutes: false,
    vue: { enable: false },
    npm: { enable: false },
    mcp: false,
    hmr: { runtime: process.env.BUN_TEST_HMR_RUNTIME || 'classic' },
  },
  plugins: [{
    name: 'issue-1222-shutdown-evidence',
    async closeServer() {
      unwatchFile(shutdownRequest)
      await appendFile(path.join(process.cwd(), 'cleanup.log'), 'closed\n')
    },
  }],
})
