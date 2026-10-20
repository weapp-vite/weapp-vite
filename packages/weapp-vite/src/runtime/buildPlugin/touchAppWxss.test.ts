import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { touchExistingAppStyle, touchExistingOutputStyles } from './touchAppWxss'

const renameMock = vi.hoisted(() => vi.fn())
const copyFileMock = vi.hoisted(() => vi.fn())

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  renameMock.mockImplementation(actual.rename)
  copyFileMock.mockImplementation(actual.copyFile)
  return { ...actual, copyFile: copyFileMock, rename: renameMock }
})

describe('existing app style refresh', () => {
  const roots: string[] = []

  afterEach(async () => {
    vi.restoreAllMocks()
    await Promise.all(roots.splice(0).map(root => fs.remove(root)))
  })

  async function createOutputPath() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-style-refresh-'))
    roots.push(root)
    return path.join(root, 'app.wxss')
  }

  it('refreshes metadata without changing the bytes emitted by the bundler', async () => {
    const output = await createOutputPath()
    const content = 'page { color: red; }'
    await fs.writeFile(output, content)
    await fs.utimes(output, new Date(0), new Date(0))
    const before = await fs.stat(output)
    expect(await touchExistingAppStyle(output)).toBe(true)
    expect(await fs.readFile(output, 'utf8')).toBe(content)
    expect((await fs.stat(output)).mtimeMs).toBeGreaterThan(before.mtimeMs)
  })

  it('does not manufacture an app stylesheet when the bundler did not emit one', async () => {
    const output = await createOutputPath()
    expect(await touchExistingAppStyle(output)).toBe(false)
    expect(await fs.pathExists(output)).toBe(false)
  })

  it('preserves the original output and propagates metadata permission failures', async () => {
    const output = await createOutputPath()
    await fs.writeFile(output, 'complete original styles')
    const failure = Object.assign(new Error('metadata denied'), { code: 'EACCES' })
    vi.spyOn(fs, 'utimes').mockRejectedValue(failure)
    await expect(touchExistingAppStyle(output)).rejects.toBe(failure)
    expect(await fs.readFile(output, 'utf8')).toBe('complete original styles')
  })

  it('touches only published page and component styles, leaving app wxss to its own policy', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-style-refresh-'))
    roots.push(root)
    const page = path.join(root, 'pages/home/index.wxss')
    const component = path.join(root, 'components/card/index.wxss')
    const app = path.join(root, 'app.wxss')
    await Promise.all([
      fs.outputFile(page, '.page {}'),
      fs.outputFile(component, '.card {}'),
      fs.outputFile(app, '.app {}'),
    ])
    const before = await Promise.all([fs.stat(page), fs.stat(component), fs.stat(app)])
    await new Promise(resolve => setTimeout(resolve, 5))
    const touched = await touchExistingOutputStyles(root, [
      'pages/home/index.wxss',
      'components\\card\\index.wxss',
      'app.wxss',
      'pages/home/index.js',
    ], 'wxss')
    const after = await Promise.all([fs.stat(page), fs.stat(component), fs.stat(app)])
    expect([...touched].sort()).toEqual([page, component].sort())
    expect(after[0].mtimeMs).toBeGreaterThan(before[0].mtimeMs)
    expect(after[1].mtimeMs).toBeGreaterThan(before[1].mtimeMs)
    expect(after[2].mtimeMs).toBe(before[2].mtimeMs)
    expect(await fs.readFile(page, 'utf8')).toBe('.page {}')
    expect(await fs.readFile(component, 'utf8')).toBe('.card {}')
    const remainingTemporaryFiles = (await fs.readdir(root)).filter(file => file.includes('.weapp-vite-style-'))
    expect(remainingTemporaryFiles).toEqual([])
  })

  it('keeps the target path present while refreshing a published style', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-style-refresh-atomic-'))
    roots.push(root)
    const page = path.join(root, 'pages/home/index.wxss')
    await fs.outputFile(page, '.page { color: red; }')
    const defaultCopyFile = copyFileMock.getMockImplementation()!
    let targetWasPresentDuringCopy = false
    copyFileMock.mockImplementationOnce(async (source: string, temporary: string) => {
      targetWasPresentDuringCopy = await fs.pathExists(page)
      return defaultCopyFile(source, temporary)
    })

    await expect(touchExistingOutputStyles(root, ['pages/home/index.wxss'], 'wxss')).resolves.toEqual(new Set([page]))
    expect(targetWasPresentDuringCopy).toBe(true)
    expect(await fs.readFile(page, 'utf8')).toBe('.page { color: red; }')
    expect((await fs.readdir(path.join(root, 'pages/home'))).some(file => file.includes('.weapp-vite-style-'))).toBe(false)
  })

  it('falls back to touching the target when the host temporarily locks it', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-style-refresh-locked-'))
    roots.push(root)
    const page = path.join(root, 'pages/home/index.wxss')
    const content = '.page { color: blue; }'
    await fs.outputFile(page, content)
    const before = await fs.stat(page)
    await new Promise(resolve => setTimeout(resolve, 5))
    renameMock.mockRejectedValueOnce(Object.assign(new Error('target is locked'), { code: 'EPERM' }))

    await expect(touchExistingOutputStyles(root, ['pages/home/index.wxss'], 'wxss')).resolves.toEqual(new Set([page]))
    expect(await fs.readFile(page, 'utf8')).toBe(content)
    expect((await fs.stat(page)).mtimeMs).toBeGreaterThan(before.mtimeMs)
    expect((await fs.readdir(path.join(root, 'pages/home'))).some(file => file.includes('.weapp-vite-style-'))).toBe(false)
  })
})
