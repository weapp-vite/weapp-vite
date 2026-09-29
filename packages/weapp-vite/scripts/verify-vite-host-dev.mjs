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
assert(['basic', 'react'].includes(profile))
assert(['dev', 'build-watch', 'stateful-dev'].includes(operation))
const require = createRequire(path.join(root, 'package.json'))
const consumer = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
assert(consumer.private && consumer.name.startsWith('weapp-vite-host-'))
assert(['wv', 'vite', 'vite-plus'].includes(toolchain))
const packageName = toolchain === 'wv' ? 'weapp-vite' : toolchain
const cli = path.join(path.dirname(require.resolve(`${packageName}/package.json`)), toolchain === 'wv' ? 'bin/weapp-vite.js' : toolchain === 'vite-plus' ? 'bin/vp' : 'bin/vite.js')
await rm(path.join(root, 'dist'), { recursive: true, force: true })
await writeFile(path.join(root, 'config-calls.txt'), '')
let logs = ''
let exited = false
const originals = new Map()
for (const file of profile === 'react' ? ['src/pages/static/view.tsx', 'vite.config.mts'] : ['src/pages/native/index.ts', 'src/pages/vue/index.vue', 'src/pages/native/index.wxml', 'vite.config.mts']) {
  originals.set(file, await readFile(path.join(root, file), 'utf8'))
}
if (operation === 'stateful-dev') {
  await writeFile(path.join(root, 'vite.config.mts'), originals.get('vite.config.mts').replace('runtime: \'classic\'', 'runtime: \'stateful-experimental\''))
}
const args = operation === 'build-watch' ? ['build', '--watch', '--logLevel', 'info'] : ['dev', ...toolchain === 'wv' ? [] : ['--host', '127.0.0.1', '--port', '0']]
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

let shutdownFailed = false
try {
  if (profile === 'react') {
    await waitForOutput('pages/static/index.wxml', 'weapp-vite React static bindings')
    await waitForOutput('pages/static/index.js', /\S/)
  }
  else {
    await waitForOutput('pages/native/index.js', 'native-host')
    await waitForOutput('pages/vue/index.js', 'vue-host')
  }
  await waitForWatchRound(1)
  if (profile === 'react') {
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
    // Vite+ 的原生启动器转交给独立进程组；优先让实际服务正常退出，再等待启动器返回。
    for (const pid of descendants.length ? descendants : [child.pid]) {
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

assert(!shutdownFailed, `Native ${toolchain} ${operation} did not exit after SIGTERM`)
