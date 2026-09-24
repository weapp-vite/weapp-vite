import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import { resolveWindowsPackageManager } from '../../../scripts/createWeappViteSmoke/process.mjs'

describe('standalone smoke Windows launch', () => {
  it.each([
    ['npm', 'node_modules/npm/bin/npm-cli.js', 'SET "NPM_CLI_JS=%~dp0\\node_modules\\npm\\bin\\npm-cli.js"'],
    ['corepack', 'node_modules/corepack/dist/corepack.js', '"%_prog%" "%dp0%\\node_modules\\corepack\\dist\\corepack.js" %*'],
    ['yarn', 'node_modules/corepack/dist/yarn.js', '"%_prog%" "%dp0%\\node_modules\\corepack\\dist\\yarn.js" %*'],
  ])('runs %s through its Node entry without interpreting path or argument metacharacters', async (manager, relativeEntry, shimSource) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'smoke-windows-launch-'))
    try {
      const executableRoot = path.join(root, 'node install & cache%')
      const entry = path.join(executableRoot, relativeEntry)
      await fs.mkdir(path.dirname(entry), { recursive: true })
      await fs.writeFile(entry, 'process.stdout.write(JSON.stringify(process.argv.slice(2)))')
      await fs.writeFile(path.join(executableRoot, `${manager}.cmd`), `${shimSource}\r\n`)
      const args = ['pnpm@12', 'a project & more', 'percent%value!', 'quoted"value', 'C:\\a directory\\']
      const invocation = resolveWindowsPackageManager(manager, args, { Path: executableRoot, PATHEXT: '.EXE;.CMD' })
      expect(invocation.command).toBe(process.execPath)
      expect(invocation.args).toEqual([entry, ...args])
      const { stdout } = await promisify(execFile)(invocation.command, invocation.args)
      expect(JSON.parse(stdout)).toEqual(args)
    }
    finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  it('resolves node_modules/.bin shims relative to their own directory', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'smoke-windows-shim-'))
    try {
      const binRoot = path.join(root, 'node_modules/.bin')
      const entry = path.join(root, 'node_modules/corepack/dist/corepack.js')
      await fs.mkdir(binRoot, { recursive: true })
      await fs.mkdir(path.dirname(entry), { recursive: true })
      await fs.writeFile(entry, '')
      await fs.writeFile(path.join(binRoot, 'corepack.cmd'), '"%_prog%" "%dp0%\\..\\corepack\\dist\\corepack.js" %*')
      expect(resolveWindowsPackageManager('corepack', ['pnpm@12'], { PATH: `"${binRoot}"` })).toEqual({
        command: process.execPath,
        args: [entry, 'pnpm@12'],
      })
    }
    finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  it('keeps native executables shell-free and rejects unsupported shims explicitly', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'smoke-windows-exe-'))
    try {
      const executable = path.join(root, 'npm.exe')
      await fs.writeFile(executable, '')
      expect(resolveWindowsPackageManager('npm', ['install'], { PATH: root })).toEqual({ command: executable, args: ['install'] })
      await fs.writeFile(path.join(root, 'yarn.cmd'), '@echo unsupported custom launcher')
      expect(() => resolveWindowsPackageManager('yarn', ['install'], { PATH: root })).toThrow('Cannot resolve the Node entry')
      expect(() => resolveWindowsPackageManager('corepack', ['install'], { PATH: root })).toThrow('Cannot resolve package manager on PATH')
    }
    finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})
