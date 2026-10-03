import assert from 'node:assert/strict'
import { realpathSync, statSync, writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

// 独立子进程专用：仅观测实际加载，不改变解析结果或替换任何模块。
const root = realpathSync(process.env.WEAPP_VITE_PROBE_ROOT)
const modules = new Map()
registerHooks({
  load(url, context, nextLoad) {
    if (url.startsWith('file:')) {
      const filename = realpathSync(fileURLToPath(url))
      const relative = path.relative(root, filename).replaceAll('\\', '/')
      assert(relative.startsWith('node_modules/'), `Consumer loaded an unpacked module: ${relative}`)
      const dependency = relative.split('node_modules/').at(-1).split('/')
      const name = dependency[0].startsWith('@') ? dependency.slice(0, 2).join('/') : dependency[0]
      modules.set(relative, { file: relative, package: name, bytes: statSync(filename).size })
    }
    return nextLoad(url, context)
  },
})
process.on('exit', (exitCode) => {
  writeFileSync(process.env.WEAPP_VITE_PROBE_OUTPUT, `${JSON.stringify({
    schemaVersion: 1,
    exitCode,
    instrumented: true,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    finalRssBytes: process.memoryUsage().rss,
    maxRssBytes: process.resourceUsage().maxRSS * 1024,
    modules: [...modules.values()].sort((a, b) => a.file.localeCompare(b.file)),
  }, null, 2)}\n`)
})
