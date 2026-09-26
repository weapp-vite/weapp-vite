import os from 'node:os'
import path from 'node:path'
import { fs } from '@weapp-core/shared/fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { touchExistingAppStyle } from './touchAppWxss'

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
})
