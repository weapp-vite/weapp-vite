import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { collectAssets } from './assets'

it('preserves binary resources and normalizes nested emitted paths', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dimina-assets-'))
  try {
    await mkdir(path.join(directory, 'sub', 'images'), { recursive: true })
    const bytes = Buffer.from([0, 255, 13, 10, 128])
    await writeFile(path.join(directory, 'sub', 'images', 'icon.png'), bytes)
    await writeFile(path.join(directory, 'logic.js'), 'module.exports = {}')
    const assets = await collectAssets(directory, 'miniapps/demo/')
    expect([...assets.keys()].sort()).toEqual(['miniapps/demo/logic.js', 'miniapps/demo/sub/images/icon.png'])
    expect(assets.get('miniapps/demo/sub/images/icon.png')).toEqual(bytes)
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
})
