import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'

const execute = promisify(execFile)
const require = createRequire(import.meta.url)
const packageRoot = path.resolve(import.meta.dirname, '..')
const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

async function createUnbuiltPackage() {
  const directory = await mkdtemp(path.join(tmpdir(), 'weapp-vite-bootstrap-'))
  directories.push(directory)
  await cp(path.join(packageRoot, 'package.json'), path.join(directory, 'package.json'))
  await cp(path.join(packageRoot, 'bin'), path.join(directory, 'bin'), { recursive: true })
  const loggerDirectory = path.join(directory, 'node_modules', '@weapp-core', 'logger')
  await mkdir(loggerDirectory, { recursive: true })
  await cp(path.resolve(packageRoot, '../../@weapp-core/logger/package.json'), path.join(loggerDirectory, 'package.json'))
  const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')) as { dependencies: Record<string, string> }
  for (const dependency of ['semver', 'picocolors']) {
    if (manifest.dependencies[dependency]) {
      const source = path.dirname(require.resolve(`${dependency}/package.json`))
      await cp(source, path.join(directory, 'node_modules', dependency), { recursive: true })
    }
  }
  return { directory, cli: path.join(directory, 'bin', 'weapp-vite.js') }
}

describe('CLI bootstrap before workspace packages have been built', () => {
  it('allows the real prepare bin to finish without CLI or logger dist', async () => {
    const { directory, cli } = await createUnbuiltPackage()
    const result = await execute(process.execPath, [cli, 'prepare'], { cwd: directory })
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('[prepare] 跳过 .weapp-vite 支持文件预生成：')
    expect(result.stderr.replaceAll('\\', '/')).toContain('dist/cli.mjs')
    expect(result.stderr).not.toContain('@weapp-core/logger')
  })

  it('preserves failures from the real CLI import for other commands', async () => {
    const { directory, cli } = await createUnbuiltPackage()
    await expect(execute(process.execPath, [cli, 'build'], { cwd: directory })).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringMatching(/dist[/\\]cli\.mjs/),
    })
  })
})
