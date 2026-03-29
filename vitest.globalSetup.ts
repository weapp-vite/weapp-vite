import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = path.dirname(fileURLToPath(new URL(import.meta.url)))
const WEAPP_VITE_DIST_DIR = path.resolve(ROOT_DIR, 'packages/weapp-vite/dist')
const execFileAsync = promisify(execFile)
const WEAPP_VITE_REQUIRED_DIST_FILES = [
  'config.mjs',
  'index.mjs',
  'json.mjs',
  'auto-routes.mjs',
  'auto-import-components/resolvers.mjs',
] as const

/**
 * @description 在测试环境下按需补齐 weapp-vite 的 dist，避免 fixture 配置依赖手动预构建
 */
async function ensureWeappViteDist() {
  for (const relativePath of WEAPP_VITE_REQUIRED_DIST_FILES) {
    const filePath = path.join(WEAPP_VITE_DIST_DIR, relativePath)
    try {
      await fs.access(filePath)
    }
    catch {
      const pnpmEntrypath = process.env.npm_execpath
      if (pnpmEntrypath) {
        await execFileAsync(process.execPath, [pnpmEntrypath, '--filter', 'weapp-vite', 'build'], {
          cwd: ROOT_DIR,
        })
      }
      else {
        const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
        await execFileAsync(pnpmCommand, ['--filter', 'weapp-vite', 'build'], {
          cwd: ROOT_DIR,
        })
      }
      return
    }
  }
}

export default async function setup() {
  await fs.mkdir(path.resolve(ROOT_DIR, 'coverage/.tmp'), { recursive: true })
  await ensureWeappViteDist()
}
