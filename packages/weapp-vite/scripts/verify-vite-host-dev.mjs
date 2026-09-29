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
const child = execFile(process.execPath, [cli, 'dev', ...toolchain === 'wv' ? [] : ['--host', '127.0.0.1', '--port', '0']], { cwd: root, detached: process.platform !== 'win32', maxBuffer: 10 * 1024 * 1024 })
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
    if (output.includes(text)) {
      return output
    }
    await delay(50)
  }
  throw new Error(`Native ${toolchain} dev did not emit ${file}: ${logs}`)
}

let shutdownFailed = false
try {
  await waitForOutput('pages/native/index.js', 'native-host')
  await waitForOutput('pages/vue/index.js', 'vue-host')
  const script = path.join(root, 'src/pages/native/index.ts')
  await writeFile(script, (await readFile(script, 'utf8')).replace('native-host', 'native-dev-update'))
  const output = await waitForOutput('pages/native/index.js', 'native-dev-update')
  assert(!output.includes('/@vite/client'))
  const vue = path.join(root, 'src/pages/vue/index.vue')
  await writeFile(vue, (await readFile(vue, 'utf8')).replace('vue-host', 'vue-dev-update'))
  await waitForOutput('pages/vue/index.js', 'vue-dev-update')
  assert.equal(await readFile(path.join(root, 'config-calls.txt'), 'utf8'), 'loaded\n')
  console.log(`${toolchain}: native classic dev initial output and TS/Vue updates passed with one config evaluation`)
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
}

assert(!shutdownFailed, `Native ${toolchain} dev did not exit after SIGTERM`)
