import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'

const root = path.resolve(process.argv[2])
const toolchain = process.argv[3]
const operation = process.argv[4] ?? 'dev'
const profile = process.argv[5] ?? 'basic'
assert(['basic', 'react', 'independent', 'worker', 'plugin'].includes(profile))
assert(['dev', 'build-watch', 'stateful-dev'].includes(operation))
const require = createRequire(path.join(root, 'package.json'))
const consumer = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
assert(consumer.private && consumer.name.startsWith('weapp-vite-host-'))
assert(['wv', 'vite', 'vite-plus'].includes(toolchain))
const packageName = toolchain === 'wv' ? 'weapp-vite' : toolchain
const cli = path.join(path.dirname(require.resolve(`${packageName}/package.json`)), toolchain === 'wv' ? 'bin/weapp-vite.js' : toolchain === 'vite-plus' ? 'bin/vp' : 'bin/vite.js')
await rm(path.join(root, 'dist'), { recursive: true, force: true })
if (profile === 'plugin') {
  await rm(path.join(root, 'dist-plugin'), { recursive: true, force: true })
}
await writeFile(path.join(root, 'config-calls.txt'), '')
let logs = ''
let exited = false
const originals = new Map()
const independentSource = 'src/subpackages/independent-wevu/pages/entry/index.vue'
const independentOutput = 'subpackages/independent-wevu/pages/entry/index.wxml'
for (const file of profile === 'plugin' ? ['shared/shared-data.ts', 'plugin/plugin.json', 'vite.config.mts'] : profile === 'react' ? ['src/pages/static/view.tsx', 'vite.config.mts'] : profile === 'independent' ? [independentSource, 'vite.config.mts'] : profile === 'worker' ? ['src/workers/messages/message.ts', 'vite.config.mts'] : ['src/pages/native/index.ts', 'src/pages/vue/index.vue', 'src/pages/native/index.wxml', 'vite.config.mts']) {
  originals.set(file, await readFile(path.join(root, file), 'utf8'))
}
if (operation === 'stateful-dev') {
  await writeFile(path.join(root, 'vite.config.mts'), originals.get('vite.config.mts').replace('runtime: \'classic\'', 'runtime: \'stateful-experimental\''))
}
const args = operation === 'build-watch' ? ['build', '--watch', '--logLevel', 'info'] : ['dev', ...toolchain === 'wv' ? [] : ['--host', '127.0.0.1', '--port', '0', '--logLevel', 'info']]
const child = execFile(process.execPath, [cli, ...args], { cwd: root, detached: process.platform !== 'win32', maxBuffer: 10 * 1024 * 1024 })
const done = new Promise((resolve) => {
  child.once('error', error => resolve({ error }))
  child.once('exit', (code, signal) => {
    exited = true
    resolve({ code, signal })
  })
})
child.stdout.on('data', (data) => {
  logs += data
})
child.stderr.on('data', (data) => {
  logs += data
})

async function waitForOutput(file, text) {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (exited) {
      break
    }
    const output = await readFile(path.join(root, 'dist', file), 'utf8').catch(() => '')
    if (typeof text === 'string' ? output.includes(text) : text.test(output)) {
      return output
    }
    await delay(50)
  }
  throw new Error(`Native ${toolchain} ${operation} did not emit ${file}: ${logs}`)
}

async function waitForWatchRound(count) {
  if (operation !== 'build-watch') {
    return
  }
  const deadline = Date.now() + 20_000
  const rounds = () => [...logs.matchAll(/built in \d+ms/g)].length
  while (rounds() < count && Date.now() < deadline) {
    if (exited) {
      break
    }
    await delay(50)
  }
  assert(rounds() >= count, `Native watch did not finish round ${count}: ${logs}`)
}

async function waitForDevReady() {
  if (operation === 'build-watch') {
    return
  }
  const deadline = Date.now() + 20_000
  while (!/开发服务已就绪|小程序开发产物已就绪/.test(logs) && Date.now() < deadline) {
    if (exited) {
      break
    }
    await delay(50)
  }
  assert(/开发服务已就绪|小程序开发产物已就绪/.test(logs), `Native ${toolchain} dev did not become ready: ${logs}`)
}

let shutdownFailed = false
try {
  if (profile === 'plugin') {
    await waitForOutput('../dist-plugin/index.js', '[shared:')
    await waitForOutput('app.json', 'hello-plugin')
  }
  else if (profile === 'react') {
    await waitForOutput('pages/static/index.wxml', 'weapp-vite React static bindings')
    await waitForOutput('pages/static/index.js', /\S/)
  }
  else if (profile === 'worker') {
    await waitForOutput('workers/messages/index.js', 'worker hello')
  }
  else if (profile === 'independent') {
    await waitForOutput(independentOutput, '__WSP_INDEPENDENT_ENTRY__')
    await waitForOutput('subpackages/independent-wevu/pages/entry/index.js', /\S/)
  }
  else {
    await waitForOutput('pages/native/index.js', 'native-host')
    await waitForOutput('pages/vue/index.js', 'vue-host')
  }
  await waitForWatchRound(1)
  await waitForDevReady()
  if (profile === 'plugin') {
    const file = 'shared/shared-data.ts'
    await writeFile(path.join(root, file), originals.get(file).replace('[shared:', '[updated-shared:'))
    await waitForOutput('../dist-plugin/index.js', '[updated-shared:')
    await waitForWatchRound(2)
    await writeFile(path.join(root, file), originals.get(file))
    await waitForOutput('../dist-plugin/index.js', '[shared:')
    await waitForWatchRound(3)
    const manifestFile = 'plugin/plugin.json'
    const manifest = JSON.parse(originals.get(manifestFile))
    delete manifest.pages['hello-page']
    await writeFile(path.join(root, manifestFile), JSON.stringify(manifest))
    const removedPage = path.join(root, 'dist-plugin/pages/hello-page/index.js')
    const deadline = Date.now() + 20_000
    while (Date.now() < deadline && await readFile(removedPage).then(() => true, () => false)) {
      await delay(50)
    }
    await assert.rejects(readFile(removedPage), { code: 'ENOENT' })
    await writeFile(path.join(root, manifestFile), originals.get(manifestFile))
    await waitForOutput('../dist-plugin/pages/hello-page/index.wxml', '插件页直接使用 Vue SFC')
    await waitForOutput('../dist-plugin/pages/hello-page/index.js', /\S/)
    assert.equal(await readFile(path.join(root, 'config-calls.txt'), 'utf8'), 'loaded\n')
    console.log(`${toolchain}: native plugin ${operation} shared import update, page removal and restoration passed with one config evaluation`)
  }
  else if (profile === 'react') {
    const source = path.join(root, 'src/pages/static/view.tsx')
    await writeFile(source, originals.get('src/pages/static/view.tsx').replace('weapp-vite React static bindings', 'React host updated template'))
    await waitForOutput('pages/static/index.wxml', 'React host updated template')
    await waitForWatchRound(2)
    // 静态 TSX 的 stateful 更新会按既有语义重启；classic/watch 不重载配置。
    if (operation !== 'stateful-dev') {
      assert.equal(await readFile(path.join(root, 'config-calls.txt'), 'utf8'), 'loaded\n')
    }
    console.log(`${toolchain}: native React ${operation} initial template and TSX update passed`)
  }
  else if (profile === 'worker') {
    const file = 'src/workers/messages/message.ts'
    await writeFile(path.join(root, file), originals.get(file).replace('worker hello', 'worker updated'))
    await waitForOutput('workers/messages/index.js', 'worker updated')
    await waitForWatchRound(2)
    await writeFile(path.join(root, file), originals.get(file))
    await waitForOutput('workers/messages/index.js', 'worker hello')
    await waitForWatchRound(3)
    assert.equal(await readFile(path.join(root, 'config-calls.txt'), 'utf8'), 'loaded\n')
    console.log(`${toolchain}: native worker ${operation} import update and restore passed with one config evaluation`)
  }
  else if (profile === 'independent') {
    await writeFile(path.join(root, independentSource), originals.get(independentSource).replace('__WSP_INDEPENDENT_ENTRY__', 'independent host updated template'))
    await waitForOutput(independentOutput, 'independent host updated template')
    await waitForWatchRound(2)
    await writeFile(path.join(root, independentSource), originals.get(independentSource))
    await waitForOutput(independentOutput, '__WSP_INDEPENDENT_ENTRY__')
    await waitForWatchRound(3)
    assert.equal(await readFile(path.join(root, 'config-calls.txt'), 'utf8'), 'loaded\n')
    console.log(`${toolchain}: native independent ${operation} template update and restore passed with one config evaluation`)
  }
  else if (operation === 'stateful-dev') {
    const control = await waitForOutput('__weapp_vite_hmr/control.js', /http:\/\/localhost:[1-9]\d*\//)
    const endpoint = control.match(/http:\/\/localhost:\d+\/__weapp_vite_stateful_hmr__/)?.[0]
    assert(endpoint, 'Stateful host must publish its HTTP transport endpoint')
    const response = await fetch(endpoint, { method: 'POST', body: '{}' })
    assert.equal(response.status, 403, 'Transport must be served by the listening host')
    const template = path.join(root, 'src/pages/native/index.wxml')
    await writeFile(template, '<view>stateful-template {{message}}</view>')
    await waitForOutput('pages/native/index.wxml', 'stateful-template')
    await writeFile(template, originals.get('src/pages/native/index.wxml'))
    await waitForOutput('pages/native/index.wxml', '<view>{{message}}</view>')
    assert.equal(await readFile(path.join(root, 'config-calls.txt'), 'utf8'), 'loaded\n')
    console.log(`${toolchain}: native stateful dev engine, host transport and template restoration passed`)
  }
  else {
    const script = path.join(root, 'src/pages/native/index.ts')
    await writeFile(script, (await readFile(script, 'utf8')).replace('native-host', 'native-dev-update'))
    const output = await waitForOutput('pages/native/index.js', 'native-dev-update')
    assert(!output.includes('/@vite/client'))
    await waitForWatchRound(2)
    const vue = path.join(root, 'src/pages/vue/index.vue')
    await writeFile(vue, (await readFile(vue, 'utf8')).replace('vue-host', 'vue-dev-update'))
    await waitForOutput('pages/vue/index.js', 'vue-dev-update')
    await waitForWatchRound(3)
    assert.equal(await readFile(path.join(root, 'config-calls.txt'), 'utf8'), 'loaded\n')
    console.log(`${toolchain}: native ${operation} initial output and TS/Vue updates passed with one config evaluation`)
  }
}
finally {
  if (process.platform === 'win32') {
    await promisify(execFile)('taskkill', ['/PID', String(child.pid), '/T', '/F']).catch(() => {})
  }
  else {
    const { stdout } = await promisify(execFile)('ps', ['-axo', 'pid=,ppid='])
    const processes = stdout.trim().split('\n').map(line => line.trim().split(/\s+/).map(Number))
    const descendants = []
    const visit = (pid) => {
      for (const [candidate, parent] of processes) {
        if (parent === pid) {
          visit(candidate)
          descendants.push(candidate)
        }
      }
    }
    visit(child.pid)
    // Vite+ 的原生启动器转交给独立进程组；wv/vite 直接接收信号并清理自己拥有的子进程。
    for (const pid of toolchain === 'vite-plus' && descendants.length ? descendants : [child.pid]) {
      try {
        process.kill(pid, 'SIGTERM')
      }
      catch (error) {
        shutdownFailed ||= error.code !== 'ESRCH'
      }
    }
  }
  const stopped = await Promise.race([done, delay(10_000, undefined, { ref: false })])
  if (!stopped) {
    if (process.platform !== 'win32') {
      try {
        process.kill(-child.pid, 'SIGKILL')
      }
      catch {}
    }
    child.kill('SIGKILL')
    await done
    shutdownFailed = true
  }
  child.stdout.destroy()
  child.stderr.destroy()
  for (const [file, content] of originals) {
    await writeFile(path.join(root, file), content)
  }
}

assert(!shutdownFailed, `Native ${toolchain} ${operation} did not exit after SIGTERM: ${logs}`)
