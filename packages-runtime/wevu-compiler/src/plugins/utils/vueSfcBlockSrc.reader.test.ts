import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseVueSfc, resolveSfcBlockSrc } from './vueSfc'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'sfc-block-reader-'))
  roots.push(root)
  const filename = path.join(root, 'page.vue')
  const file = path.join(root, 'template.html')
  const parsed = parseVueSfc('<template src="./template.html"></template>', { filename })
  expect(parsed.errors).toEqual([])
  return { filename, file, descriptor: parsed.descriptor }
}

describe('SFC block reader error contract', () => {
  it.each([
    ['Error object', new Error('reader requested another input generation')],
    ['plain object', { retry: true }],
    ['primitive', 'reader requested another input generation'],
  ])('preserves the original custom reader %s', async (_kind, failure) => {
    const { filename, file, descriptor } = await fixture()
    const readFile = vi.fn(async () => {
      throw failure
    })

    await expect(resolveSfcBlockSrc(descriptor, filename, { readFile, checkMtime: false })).rejects.toBe(failure)
    expect(readFile).toHaveBeenCalledExactlyOnceWith(file, { checkMtime: false })
  })

  it('preserves a synchronous custom reader throw without adding file context', async () => {
    const { filename, descriptor } = await fixture()
    const failure = { retry: true }

    await expect(resolveSfcBlockSrc(descriptor, filename, {
      readFile() {
        throw failure
      },
    })).rejects.toBe(failure)
  })

  it('retains Chinese file context and the original cause for a missing default-reader file', async () => {
    const { filename, file, descriptor } = await fixture()

    await expect(resolveSfcBlockSrc(descriptor, filename, { checkMtime: true })).rejects.toMatchObject({
      message: expect.stringContaining(`解析 ${filename} 失败：读取 ${file} 失败：`),
      cause: expect.objectContaining({ code: 'ENOENT' }),
    })
  })
})
