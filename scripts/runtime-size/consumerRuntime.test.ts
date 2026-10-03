import type { LoadedConsumerRuntime } from './consumerRuntime'
import { mkdir, mkdtemp, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadConsumerRuntime, verifyConsumerRuntime } from './consumerRuntime'

describe('installed consumer runtime verification', () => {
  const directories: string[] = []
  afterEach(async () => {
    await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
  })

  async function temporaryRoot() {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'consumer-runtime-')))
    directories.push(root)
    return root
  }

  async function writePackage(directory: string, source = 'export function createTestProject() {}') {
    await mkdir(directory, { recursive: true })
    await writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: '@mpcore/test', version: '1.0.0', type: 'module', exports: { '.': { import: './index.mjs' } } }))
    await writeFile(path.join(directory, 'index.mjs'), source)
  }

  it('resolves the consumer import export and removes its temporary ESM resolver', async () => {
    const root = await temporaryRoot()
    await writePackage(path.join(root, 'node_modules/@mpcore/test'))
    const runtime = await loadConsumerRuntime(root)
    expect(runtime.package).toMatchObject({ name: '@mpcore/test', version: '1.0.0', entry: 'node_modules/@mpcore/test/index.mjs' })
    expect(runtime.package.entrySha256).toMatch(/^[\da-f]{64}$/)
    expect(await readdir(root)).toEqual(['node_modules'])
  })

  it('rejects a linked runtime outside the consumer before importing it', async () => {
    const root = await temporaryRoot()
    const outside = await temporaryRoot()
    await writePackage(outside, 'throw new Error("The outside runtime must not be imported")')
    await mkdir(path.join(root, 'node_modules/@mpcore'), { recursive: true })
    await symlink(outside, path.join(root, 'node_modules/@mpcore/test'), 'junction')
    await expect(loadConsumerRuntime(root)).rejects.toThrow('escapes its installed node_modules tree')
    expect(await readdir(root)).toEqual(['node_modules'])
  })

  it('closes a project when rendering fails and passes the explicit built artifact', async () => {
    const root = await temporaryRoot()
    const close = vi.fn(async () => {})
    const createTestProject = vi.fn(() => ({
      renderPage: vi.fn(async () => {
        throw new Error('render failed')
      }),
      close,
    }))
    await expect(verifyConsumerRuntime(root, 'minimal', { createTestProject } as unknown as LoadedConsumerRuntime)).rejects.toThrow('render failed')
    expect(createTestProject).toHaveBeenCalledWith({
      artifact: { projectPath: root, miniprogramRootPath: path.join(root, 'dist'), appConfigPath: path.join(root, 'dist/app.json') },
      failOnConsoleError: true,
    })
    expect(close).toHaveBeenCalledOnce()
  })
})
