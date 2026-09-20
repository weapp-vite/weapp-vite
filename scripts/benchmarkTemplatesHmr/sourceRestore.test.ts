import { mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { restoreBenchmarkSource } from './sourceRestore'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(source: string) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hmr-source-restore-'))
  roots.push(root)
  const filename = path.join(root, 'app.json')
  await writeFile(filename, source)
  return filename
}

describe('benchmark source cleanup', () => {
  it('preserves filesystem timestamps when measured restoration already finished', async () => {
    const original = '{"pages":["pages/index/index"]}\n'
    const filename = await fixture(original)
    const timestamp = new Date('2020-01-01T00:00:00Z')
    await utimes(filename, timestamp, timestamp)
    const before = await stat(filename)

    expect(await restoreBenchmarkSource(filename, original)).toBe(false)
    expect((await stat(filename)).mtimeMs).toBe(before.mtimeMs)
    expect(await readFile(filename, 'utf8')).toBe(original)
  })

  it('restores changed source once after an interrupted measurement', async () => {
    const filename = await fixture('{"title":"HMR_MARKER"}')
    expect(await restoreBenchmarkSource(filename, '{"title":"original"}')).toBe(true)
    expect(await readFile(filename, 'utf8')).toBe('{"title":"original"}')
    expect(await restoreBenchmarkSource(filename, '{"title":"original"}')).toBe(false)
  })

  it('does not treat a source read failure as successful restoration', async () => {
    const filename = await fixture('original')
    await rm(filename)
    await expect(restoreBenchmarkSource(filename, 'original')).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
