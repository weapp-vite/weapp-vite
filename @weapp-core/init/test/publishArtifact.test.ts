import { execFileSync } from 'node:child_process'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

function execPnpmSync(args: string[], cwd: string) {
  const pnpmEntrypath = process.env.npm_execpath
  if (pnpmEntrypath) {
    execFileSync(process.execPath, [pnpmEntrypath, ...args], {
      cwd,
      encoding: 'utf8',
      stdio: 'pipe',
    })
    return
  }

  execFileSync('pnpm', args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: 'pipe',
  })
}

describe('publish artifact', () => {
  it('keeps fs imports on the @weapp-core/shared/node subpath in the built artifact', async () => {
    const packageRoot = path.resolve(import.meta.dirname, '..')
    const workspaceRoot = path.resolve(import.meta.dirname, '../../..')
    execPnpmSync(['--dir', workspaceRoot, '--filter', '@weapp-core/init', 'build'], workspaceRoot)
    const builtIndex = await fs.readFile(path.join(packageRoot, 'dist/index.js'), 'utf8')

    expect(builtIndex).toContain('import { fs } from "@weapp-core/shared/node";')
    expect(builtIndex).toContain('import { defu, get, set } from "@weapp-core/shared";')
    expect(builtIndex).not.toContain('import { defu, fs, get, set } from "@weapp-core/shared";')
  })
})
