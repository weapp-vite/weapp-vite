import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const stateDirectory = process.env.WEAPP_VITE_PROCESS_FIXTURE_DIR
if (!stateDirectory) {
  throw new Error('Missing process fixture state directory')
}

const cleanupFile = path.join(stateDirectory, 'cleanup')
if (fs.existsSync(cleanupFile)) {
  process.exit(0)
}
let ownedChild

// 清理信号只让此隔离 fixture 自行退出；测试进程无需按 PID 强杀孤儿后代。
setInterval(() => {
  if (fs.existsSync(cleanupFile)) {
    // 根进程持有真实 ChildProcess，等其后代自行退出后再确认此树已收尾。
    if (!ownedChild || ownedChild.exitCode !== null || ownedChild.signalCode !== null) {
      process.exit(0)
    }
  }
}, 25)
// 测试 worker 异常退出时也不能永久留下 fixture。
setTimeout(() => process.exit(2), 90_000)

if (process.argv[2] === 'descendant') {
  fs.writeFileSync(path.join(stateDirectory, 'descendant.json'), JSON.stringify({ pid: process.pid }))
  // Windows 不提供 POSIX 可捕获 TERM 语义，由同一集成测试验证 taskkill 的整树退出路径。
  if (process.platform !== 'win32') {
    process.on('SIGTERM', () => {
      fs.writeFileSync(path.join(stateDirectory, 'term-ignored'), String(process.pid))
    })
  }
  process.send?.({ pid: process.pid })
}
else {
  const child = spawn(process.execPath, [process.argv[1], 'descendant'], {
    env: process.env,
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    windowsHide: true,
  })
  ownedChild = child
  child.once('error', (error) => {
    process.stderr.write(`${error.message}\n`)
    process.exit(1)
  })
  child.once('message', (message) => {
    if (!message || typeof message !== 'object' || message.pid !== child.pid) {
      throw new Error('Unexpected descendant registration')
    }
    const registration = JSON.stringify({ rootPid: process.pid, descendantPid: child.pid })
    const pendingFile = path.join(stateDirectory, 'ready.pending')
    fs.writeFileSync(pendingFile, registration)
    fs.renameSync(pendingFile, path.join(stateDirectory, 'ready.json'))
    process.stdout.write(`DEV_PROCESS_TREE_READY ${registration}\n`)
  })
}
