import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { publishPreparedTemplates, withPreparationLock } from '../../packages/create-weapp-vite/scripts/templatePreparation'
import { createOwner } from '../../packages/create-weapp-vite/scripts/templatePreparation/owner'
import { assertPreparedTemplate, digestDirectory } from '../../packages/create-weapp-vite/src/templates/prepared'

const roots: string[] = []

async function temporaryRoot() {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'vite-plus-preparation-')))
  roots.push(root)
  return root
}

async function ownerFile(file: string, root: string) {
  const owner = { ...createOwner(root), pid: process.pid + 1 }
  await fs.writeFile(file, JSON.stringify(owner))
  return owner
}

function exitedProcess() {
  vi.spyOn(process, 'kill').mockImplementation(() => {
    throw Object.assign(new Error('No such process'), { code: 'ESRCH' })
  })
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

describe('prepared template integrity', () => {
  it('checks critical files and the complete content digest before copying', async () => {
    const root = await temporaryRoot()
    const directory = path.join(root, 'default')
    await fs.mkdir(directory)
    for (const name of ['package.json', 'AGENTS.md', 'vite.config.ts', 'weapp-vite.config.ts']) {
      await fs.writeFile(path.join(directory, name), '{}\n')
    }
    await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify({ templates: { default: await digestDirectory(directory) } }))
    await expect(assertPreparedTemplate(directory, 'default')).resolves.toBeUndefined()
    await fs.writeFile(path.join(directory, 'extra.ts'), 'export const changed = true\n')
    await expect(assertPreparedTemplate(directory, 'default')).rejects.toThrow('缺失或损坏')
    await fs.rm(path.join(directory, 'extra.ts'))
    await fs.rm(path.join(directory, 'vite.config.ts'))
    await expect(assertPreparedTemplate(directory, 'default')).rejects.toThrow('templates:prepare')
    await expect(assertPreparedTemplate(directory, 'unknown')).rejects.toThrow('unknown')
  })

  it('rejects malformed manifests and does not silently omit symlinked template files', async () => {
    const root = await temporaryRoot()
    const directory = path.join(root, 'default')
    await fs.mkdir(directory)
    await fs.writeFile(path.join(root, 'manifest.json'), '{')
    await expect(assertPreparedTemplate(directory, 'default')).rejects.toThrow('发布包须包含完整派生模板')
    const external = await temporaryRoot()
    await fs.symlink(external, path.join(directory, 'external'), 'junction')
    await expect(digestDirectory(directory)).rejects.toThrow('不支持的文件类型')
  })
})

describe('preparation lock ownership', () => {
  it('records ownership and releases its lock when preparation throws', async () => {
    const root = await temporaryRoot()
    const file = path.join(root, '.vite-plus.lock')
    await expect(withPreparationLock(root, async () => {
      const owner: unknown = JSON.parse(await fs.readFile(file, 'utf8'))
      expect(owner).toMatchObject({ pid: process.pid, root })
      throw new Error('preparation failed')
    })).rejects.toThrow('preparation failed')
    await expect(fs.stat(file)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('preserves active and unknown locks without running the callback', async () => {
    const root = await temporaryRoot()
    const file = path.join(root, '.vite-plus.lock')
    const action = vi.fn()
    for (const content of [JSON.stringify(createOwner(root)), '', '{invalid']) {
      await fs.writeFile(file, content)
      await expect(withPreparationLock(root, action, { timeoutMs: 0 })).rejects.toThrow('已保留')
      expect(await fs.readFile(file, 'utf8')).toBe(content)
    }
    expect(action).not.toHaveBeenCalled()
  })

  it('recovers only an owner confirmed exited by ESRCH, preserving permission failures', async () => {
    const root = await temporaryRoot()
    const file = path.join(root, '.vite-plus.lock')
    await ownerFile(file, root)
    const original = await fs.readFile(file)
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw Object.assign(new Error('Access denied'), { code: 'EPERM' })
    })
    await expect(withPreparationLock(root, async () => {}, { timeoutMs: 0 })).rejects.toThrow('超时')
    expect(await fs.readFile(file)).toEqual(original)
    vi.restoreAllMocks()
    exitedProcess()
    await expect(withPreparationLock(root, async () => 'recovered', { timeoutMs: 100, pollMs: 1 })).resolves.toBe('recovered')
    await expect(fs.stat(file)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.stat(`${file}.recovery`)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('does not remove a replaced lock or an unknown interrupted recovery marker', async () => {
    const root = await temporaryRoot()
    const file = path.join(root, '.vite-plus.lock')
    let replacement = ''
    await withPreparationLock(root, async () => {
      replacement = JSON.stringify(createOwner(root))
      await fs.writeFile(file, replacement)
    })
    expect(await fs.readFile(file, 'utf8')).toBe(replacement)
    await fs.writeFile(`${file}.recovery`, 'unknown recovery owner')
    await expect(withPreparationLock(root, async () => {}, { timeoutMs: 0 })).rejects.toThrow('回收标记已保留')
    expect(await fs.readFile(`${file}.recovery`, 'utf8')).toBe('unknown recovery owner')
  })
})

describe('prepared template publication', () => {
  async function fixture() {
    const root = await temporaryRoot()
    const staging = await temporaryRoot()
    const destination = path.join(root, 'vite-plus')
    await fs.mkdir(destination)
    await fs.writeFile(path.join(destination, 'version'), 'old-complete')
    await fs.writeFile(path.join(staging, 'version'), 'new-complete')
    return { root, staging, destination }
  }

  it('keeps the complete previous copy when copying the new tree fails', async () => {
    const { root, staging, destination } = await fixture()
    vi.spyOn(fs, 'cp').mockRejectedValueOnce(new Error('copy interrupted'))
    await expect(publishPreparedTemplates(staging, destination)).rejects.toThrow('copy interrupted')
    expect(await fs.readFile(path.join(destination, 'version'), 'utf8')).toBe('old-complete')
    expect(await fs.readdir(root)).toEqual(['vite-plus'])
    expect(await fs.readFile(path.join(staging, 'version'), 'utf8')).toBe('new-complete')
  })

  it('rolls back a failed final rename and only cleans its own temporary directory', async () => {
    const { root, staging, destination } = await fixture()
    const rename = fs.rename.bind(fs)
    await fs.mkdir(path.join(root, '.vite-plus.publish-unrelated'))
    vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      if (path.basename(String(from)) === 'next') {
        throw new Error('publication interrupted')
      }
      return rename(from, to)
    })
    await expect(publishPreparedTemplates(staging, destination)).rejects.toThrow('publication interrupted')
    expect(await fs.readFile(path.join(destination, 'version'), 'utf8')).toBe('old-complete')
    expect((await fs.readdir(root)).sort()).toEqual(['.vite-plus.publish-unrelated', 'vite-plus'])
  })

  it('recovers a killed publisher backup before attempting the next copy', async () => {
    const { root, staging, destination } = await fixture()
    const transaction = await fs.mkdtemp(path.join(root, '.vite-plus.publish-'))
    await ownerFile(path.join(transaction, 'owner.json'), destination)
    await fs.rename(destination, path.join(transaction, 'previous'))
    exitedProcess()
    vi.spyOn(fs, 'cp').mockRejectedValueOnce(new Error('next copy failed'))
    await expect(publishPreparedTemplates(staging, destination)).rejects.toThrow('next copy failed')
    expect(await fs.readFile(path.join(destination, 'version'), 'utf8')).toBe('old-complete')
    expect(await fs.readdir(root)).toEqual(['vite-plus'])
  })

  it('publishes a complete sibling copy while retaining the caller-owned source', async () => {
    const { root, staging, destination } = await fixture()
    await publishPreparedTemplates(staging, destination)
    expect(await fs.readFile(path.join(destination, 'version'), 'utf8')).toBe('new-complete')
    expect(await fs.readFile(path.join(staging, 'version'), 'utf8')).toBe('new-complete')
    expect(await fs.readdir(root)).toEqual(['vite-plus'])
  })
})
