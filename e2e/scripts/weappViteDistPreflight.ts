/* eslint-disable e18e/ban-dependencies -- 复用跨平台进程封装构建运行时 CLI。 */
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
let buildPromise: Promise<void> | undefined

function resolvePnpmCommand() {
  const pnpmEntrypath = process.env.npm_execpath?.trim()
  if (pnpmEntrypath) {
    const useNode = /\.(?:c|m)?js$/i.test(path.extname(pnpmEntrypath))
    return {
      command: useNode ? process.execPath : pnpmEntrypath,
      args: useNode ? [pnpmEntrypath, '--filter', 'weapp-vite...', 'build'] : ['--filter', 'weapp-vite...', 'build'],
    }
  }

  return {
    command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    args: ['--filter', 'weapp-vite...', 'build'],
  }
}

/** 在受管 E2E 启动前生成当前 checkout 对应的 CLI 产物，避免旧 dist 进入下游运行时。 */
export function ensureWeappViteDist(signal?: AbortSignal) {
  if (process.env.VITEST) {
    return Promise.resolve()
  }
  buildPromise ??= (async () => {
    const { command, args } = resolvePnpmCommand()
    await execa(command, args, { cwd: ROOT_DIR, stdio: 'inherit', ...(signal ? { cancelSignal: signal } : {}) })
  })()
  return buildPromise
}
