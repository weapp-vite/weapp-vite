import path from 'node:path'
import process from 'node:process'
import { createDevViteServer } from '../../src/devLifecycle/vite'
import { adapterRegistrationReady } from '../../src/runtime/watch/viteAdapter'
import { serverConfig } from './support'

const root = process.argv[2]
if (!root) {
  throw new Error('The watcher lifetime probe requires its owned fixture root')
}
const server = await createDevViteServer({
  ...serverConfig(root),
  // Vite 8 的 hmr:false 仍可持有独立 WS 服务；本场景只观察 watcher 的存活所有权。
  server: { ...serverConfig(root).server, ws: false, watch: { usePolling: true, interval: 10, persistent: false } },
})
server.watcher.ref()
await adapterRegistrationReady(server)
const control = path.join(root, 'control.txt')
server.watcher.on('change', (file) => {
  if (path.resolve(file) === control) {
    server.watcher.unref()
    console.log('watcher-unreferenced')
  }
})
// 观察一个未引用的定时器仍能执行；此时只有 watcher owner 承担进程存活。
setTimeout(() => console.log('watcher-kept-process-alive'), 100).unref()
