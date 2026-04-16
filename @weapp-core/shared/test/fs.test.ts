import os from 'node:os'
import path from 'node:path'
import { fs } from '@/fs'

describe('shared fs', () => {
  it('supports output/read/write json helpers', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shared-fs-'))
    const outputPath = path.join(root, 'nested/data.json')

    await fs.outputJson(outputPath, { ok: true }, { spaces: 2 })

    expect(await fs.pathExists(outputPath)).toBe(true)
    expect(await fs.readJson(outputPath)).toEqual({ ok: true })

    await fs.writeJson(outputPath, { ok: false })
    expect(fs.readJsonSync(outputPath)).toEqual({ ok: false })

    await fs.remove(root)
  })

  it('supports copy move and emptyDir helpers', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shared-fs-'))
    const sourceDir = path.join(root, 'source')
    const copiedDir = path.join(root, 'copied')
    const movedDir = path.join(root, 'moved')

    await fs.outputFile(path.join(sourceDir, 'a.txt'), 'a', 'utf8')
    await fs.outputFile(path.join(sourceDir, 'nested/b.txt'), 'b', 'utf8')

    await fs.copy(sourceDir, copiedDir)
    expect(await fs.readFile(path.join(copiedDir, 'nested/b.txt'), 'utf8')).toBe('b')

    await fs.move(copiedDir, movedDir)
    expect(await fs.pathExists(copiedDir)).toBe(false)
    expect(await fs.pathExists(path.join(movedDir, 'a.txt'))).toBe(true)

    await fs.emptyDir(movedDir)
    expect(await fs.readdir(movedDir)).toEqual([])

    await fs.remove(root)
  })
})
