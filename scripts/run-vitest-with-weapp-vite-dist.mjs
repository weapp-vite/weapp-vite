import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const WEAPP_VITE_DIST_DIR = path.resolve(ROOT_DIR, 'packages/weapp-vite/dist')
const REQUIRED_DIST_FILES = [
  'config.mjs',
  'index.mjs',
  'json.mjs',
  'auto-routes.mjs',
  'auto-import-components/resolvers.mjs',
]

async function hasRequiredDistFiles() {
  for (const relativePath of REQUIRED_DIST_FILES) {
    try {
      await fs.access(path.join(WEAPP_VITE_DIST_DIR, relativePath))
    }
    catch {
      return false
    }
  }
  return true
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    })

    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`command exited with signal ${signal}`))
        return
      }
      resolve(code ?? 0)
    })
  })
}

async function ensureWeappViteDist() {
  if (await hasRequiredDistFiles()) {
    return
  }

  const pnpmEntrypath = process.env.npm_execpath
  if (pnpmEntrypath) {
    const code = await runCommand(process.execPath, [pnpmEntrypath, '--filter', 'weapp-vite', 'build'])
    if (code !== 0) {
      process.exit(code)
    }
    return
  }

  const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const code = await runCommand(pnpmCommand, ['--filter', 'weapp-vite', 'build'])
  if (code !== 0) {
    process.exit(code)
  }
}

async function main() {
  await ensureWeappViteDist()

  const vitestEntrypath = path.resolve(ROOT_DIR, 'node_modules/vitest/vitest.mjs')
  const code = await runCommand(process.execPath, [vitestEntrypath, ...process.argv.slice(2)])
  process.exit(code)
}

await main()
