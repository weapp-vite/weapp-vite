import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { finished } from 'node:stream/promises'
import { promisify } from 'node:util'

const run = promisify(execFile)
const preload = new URL('./stdinPreload.mjs', import.meta.url).href

/** 保留既有 Node 参数，让所有实际开发宿主通过原生 stdin EOF 正常关闭。 */
export function consumerProcessEnvironment(operation, inherited = process.env) {
  if (operation === 'build-watch') {
    return { ...inherited }
  }
  return { ...inherited, CI: 'false', NODE_OPTIONS: [inherited.NODE_OPTIONS, `--import=${preload}`].filter(Boolean).join(' ') }
}

/** 配置缺失也是需要恢复的用户状态；其他读取错误必须保留。 */
export async function readConsumerPrivateConfig(root) {
  try {
    return await readFile(path.join(root, 'project.private.config.json'))
  }
  catch (error) {
    if (error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

/** 只核验产品自己的恢复结果，验收脚本不能代替 owner 撤销设置。 */
export async function assertConsumerPrivateConfigRestored(root, original) {
  assert.deepEqual(await readConsumerPrivateConfig(root), original, 'Development shutdown must restore the original private IDE configuration')
}

function isHeld(child) {
  return Number.isInteger(child.pid) && child.exitCode === null && child.signalCode === null
}

async function within(task, timeoutMs) {
  let timer
  try {
    return await Promise.race([
      task,
      new Promise((_resolve, reject) => timer = setTimeout(() => reject(new Error('Consumer process exit or output drain timed out')), timeoutMs)),
    ])
  }
  finally {
    clearTimeout(timer)
  }
}

/** watch 保留原信号路径；开发服务先通过 EOF 正常关闭，不能用强杀代替恢复验收。 */
async function stopWatch(child, toolchain) {
  if (!isHeld(child)) {
    return
  }
  if (process.platform === 'win32') {
    await run('taskkill', ['/PID', String(child.pid), '/T', '/F'])
    return
  }
  const { stdout } = await run('ps', ['-axo', 'pid=,ppid='])
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
  for (const pid of toolchain === 'vite-plus' && descendants.length ? descendants : [child.pid]) {
    try {
      process.kill(pid, 'SIGTERM')
    }
    catch (error) {
      if (error.code !== 'ESRCH') {
        throw error
      }
    }
  }
}

/** 只终止仍由当前 ChildProcess 持有的根与创建时独占的进程组；未知后代保留并报错。 */
async function forceStop(child) {
  if (!isHeld(child)) {
    return
  }
  if (process.platform === 'win32') {
    await run('taskkill', ['/PID', String(child.pid), '/T', '/F'])
    return
  }
  try {
    process.kill(-child.pid, 'SIGKILL')
  }
  catch (error) {
    if (error.code !== 'ESRCH') {
      throw error
    }
  }
  if (isHeld(child)) {
    child.kill('SIGKILL')
  }
}

/** 正常退出、输出排空和成功退出码缺一不可；强制回收只能保留为失败证据。 */
export async function stopConsumerProcess({ child, done, operation, toolchain, timeoutMs = 10_000, requestWatchStop = stopWatch, forceCleanup = forceStop }) {
  // EOF 可能同步触发 EPIPE，必须先为每条流登记终结与错误监听。
  const resources = [
    done,
    finished(child.stdout, { cleanup: true }),
    finished(child.stderr, { cleanup: true }),
    ...operation === 'build-watch' ? [] : [finished(child.stdin, { cleanup: true, readable: false })],
  ]
  const completion = Promise.all(resources).then(([result]) => result)
  // 提前消费拒绝，避免关闭请求本身抛错时遗留无人处理的 stream 错误。
  void completion.catch(() => {})
  try {
    const result = await within((async () => {
      if (operation === 'build-watch') {
        await requestWatchStop(child, toolchain)
      }
      else if (isHeld(child)) {
        child.stdin.end()
      }
      return await completion
    })(), timeoutMs)
    if (result.error) {
      throw result.error
    }
    if (operation !== 'build-watch') {
      assert.deepEqual(result, { code: 0, signal: null }, 'Development EOF must finish successfully without a terminating signal')
    }
  }
  catch (error) {
    const errors = [error]
    try {
      // 首条流已失败时不能复用 fail-fast Promise；清理与全部资源各自结算，共享收尾预算。
      const cleanup = [
        Promise.resolve().then(() => forceCleanup(child)),
        ...resources,
      ].map(task => Promise.resolve(task).catch((reason) => {
        // 其他资源迟迟未终结时，已经返回的清理错误也不能被总预算耗尽覆盖。
        if (!errors.includes(reason)) {
          errors.push(reason)
        }
        throw reason
      }))
      await within(Promise.allSettled(cleanup), timeoutMs)
    }
    catch (cleanupError) {
      if (!errors.includes(cleanupError)) {
        errors.push(cleanupError)
      }
    }
    child.stdout.destroy()
    child.stderr.destroy()
    throw new AggregateError(errors, `Native ${toolchain} ${operation} did not close cleanly`, { cause: error })
  }
}
