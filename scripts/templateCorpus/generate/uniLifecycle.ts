/** 官方开发复制插件会保留 FileWatcher；仅在隔离编译子进程登记并释放自身实例。 */
export function createFiniteUniLauncher(): string {
  return `const process = require('node:process')
process.env.NODE_ENV = process.argv[2]
require('@dcloudio/uni-cli-shared/dist/alias')
require('@dcloudio/uni-cli-shared/dist/polyfill')
const { FileWatcher } = require('@dcloudio/uni-cli-shared/dist/watcher')
const { initEnv } = require('@dcloudio/vite-plugin-uni/dist/cli/utils')
const { build } = require('@dcloudio/vite-plugin-uni/dist/cli/build')
const options = { platform: process.argv[3], outDir: process.argv[4], mode: process.argv[2] }
initEnv(process.argv[2] === 'development' ? 'dev' : 'build', options)
async function finiteBuild() {
  const owned = new Set()
  const originalWatch = FileWatcher.prototype.watch
  const failures = []
  FileWatcher.prototype.watch = function (...args) {
    const result = originalWatch.apply(this, args)
    owned.add(this)
    return result
  }
  try {
    await build(options)
  } catch (error) {
    failures.push(error)
  } finally {
    const cleanup = await Promise.allSettled([...owned].map(watcher => Promise.resolve().then(() => watcher.close())))
    FileWatcher.prototype.watch = originalWatch
    failures.push(...cleanup.filter(result => result.status === 'rejected').map(result => result.reason))
  }
  if (failures.length) throw new AggregateError(failures, 'Controlled uni build or watcher cleanup failed')
  console.log('template-corpus:finite-build ' + JSON.stringify({ mode: process.env.NODE_ENV, ownedWatchersClosed: owned.size }))
}
module.exports = finiteBuild()
module.exports.catch(error => { console.error(error); process.exitCode = 1 })
`
}
