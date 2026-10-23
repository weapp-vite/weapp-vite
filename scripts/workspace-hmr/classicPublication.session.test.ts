import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { parse } from '@babel/parser'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY } from '@weapp-core/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClassicPublicationInspector } from './classicPublication'

const fsHooks = vi.hoisted(() => ({ beforeReaddir: undefined as (() => Promise<void>) | undefined }))
vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...original,
    async readdir(...args: Parameters<typeof original.readdir>) {
      await fsHooks.beforeReaddir?.()
      return original.readdir(...args)
    },
  }
})
vi.mock('@babel/parser', async (importOriginal) => {
  const original = await importOriginal<typeof import('@babel/parser')>()
  return { ...original, parse: vi.fn(original.parse) }
})

const roots: string[] = []
async function createOutput() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'classic-publication-session-'))
  roots.push(root)
  await writeFile(path.join(root, 'app.json'), '{"pages":[]}')
  await writeFile(path.join(root, 'app.js'), 'require("./shared.js"); App({});')
  await writeFile(path.join(root, 'shared.js'), 'module.exports = {};')
  return root
}

beforeEach(() => {
  vi.mocked(parse).mockClear()
})
afterEach(async () => {
  fsHooks.beforeReaddir = undefined
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('classic publication session content summaries', () => {
  it('parses each content once, retains complete inventory and hashes, and never reuses mutable snapshots', async () => {
    const root = await createOutput()
    const inspect = createClassicPublicationInspector(root)
    const first = await inspect()
    expect(parse).toHaveBeenCalledTimes(2)
    first.snapshot.clear()
    const second = await inspect()
    expect(parse).toHaveBeenCalledTimes(2)
    expect([...second.snapshot.keys()]).toEqual(['app.js', 'app.json', 'shared.js'])
    expect(second.checkedFileCount).toBe(3)
    expect(second.files).toHaveLength(3)
    expect(second.snapshot.get('shared.js')).toEqual({
      hash: createHash('sha256').update('module.exports = {};').digest('hex'),
      size: 20,
    })
  })

  it('rechecks cached script dependencies against the current inventory', async () => {
    const root = await createOutput()
    const inspect = createClassicPublicationInspector(root)
    await inspect()
    await rm(path.join(root, 'shared.js'))
    await expect(inspect()).rejects.toThrow('missing script dependency ./shared.js from app.js')
    expect(parse).toHaveBeenCalledTimes(2)
  })

  it('rechecks the owner path when identical script bytes appear in a new directory', async () => {
    const root = await createOutput()
    const inspect = createClassicPublicationInspector(root)
    await inspect()
    await mkdir(path.join(root, 'other'))
    await writeFile(path.join(root, 'other/runtime.js'), 'require("./shared.js"); App({});')
    await expect(inspect()).rejects.toThrow('missing script dependency ./shared.js from other/runtime.js')
    expect(parse).toHaveBeenCalledTimes(2)
  })

  it.each(['same-path', 'new-orphan'])('inspects escaped runtime keys and lexical aliases in %s content after a successful check', async (change) => {
    const root = await createOutput()
    const inspect = createClassicPublicationInspector(root)
    await inspect()
    const escaped = JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY).replaceAll('_', '\\u005f')
    const source = `const key = ${escaped}; function unrelated(key) { return key; } globalThis[key] = {};`
    await writeFile(path.join(root, change === 'same-path' ? 'shared.js' : 'orphan.js'), source)
    await expect(inspect()).rejects.toThrow(`must remove ${WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY}`)
  })

  it('does not share script summaries or resolved dependencies between project sessions', async () => {
    const firstRoot = await createOutput()
    await createClassicPublicationInspector(firstRoot)()
    const secondRoot = await createOutput()
    await rm(path.join(secondRoot, 'shared.js'))
    await expect(createClassicPublicationInspector(secondRoot)()).rejects.toThrow('missing script dependency')
    expect(parse).toHaveBeenCalledTimes(3)
  })

  it('rechecks cached component declarations against the current app extended library configuration', async () => {
    const root = await createOutput()
    await writeFile(path.join(root, 'app.json'), '{"pages":[],"useExtendedLib":{"weui":true}}')
    await writeFile(path.join(root, 'orphan.json'), '{"usingComponents":{"badge":"weui-miniprogram/badge/badge"}}')
    const inspect = createClassicPublicationInspector(root)
    await inspect()
    await writeFile(path.join(root, 'app.json'), '{"pages":[],"useExtendedLib":{"weui":false}}')
    await expect(inspect()).rejects.toThrow('missing')
  })

  it.each(['add', 'remove', 'modify'] as const)('rejects a file %s during the second complete disk snapshot', async (change) => {
    const root = await createOutput()
    const inspect = createClassicPublicationInspector(root)
    await inspect()
    let scans = 0
    fsHooks.beforeReaddir = async () => {
      if (++scans !== 2) {
        return
      }
      if (change === 'add') {
        await writeFile(path.join(root, 'image.png'), 'new asset')
      }
      else if (change === 'remove') {
        await rm(path.join(root, 'shared.js'))
      }
      else {
        await writeFile(path.join(root, 'shared.js'), 'module.exports = { changed: true };')
      }
    }
    await expect(inspect()).rejects.toThrow('changed during its complete output inspection')
    expect(scans).toBe(2)
  })
})
