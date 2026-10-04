import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE } from '@weapp-core/constants'
import { afterEach, describe, expect, it } from 'vitest'
import { hashHmrOutput, readHmrOutputIdentity } from './hmrOutputDiagnostics'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('HMR output identity diagnostics', () => {
  it('detects a changed startup dependency even when the page entry is unchanged', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'hmr-output-'))
    roots.push(root)
    const page = 'Page(require("./shared.js"))'
    await writeFile(path.join(root, 'page.js'), page)
    await writeFile(path.join(root, 'shared.js'), 'exports.style = ""')
    const before = await readHmrOutputIdentity(root)

    await writeFile(path.join(root, 'shared.js'), 'exports.style = "--theme:red"')
    const after = await readHmrOutputIdentity(root)

    expect(after.startupHash).not.toBe(before.startupHash)
    expect(after.files.find(file => file.file === 'page.js')?.hash).toBe(hashHmrOutput(page))
    expect(after.files.find(file => file.file === 'shared.js')?.hash)
      .not
      .toBe(before.files.find(file => file.file === 'shared.js')?.hash)
  })

  it('keeps incremental transport and asset changes separate from startup scripts', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'hmr-output-'))
    roots.push(root)
    const updateFile = path.join(root, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE)
    await mkdir(path.dirname(updateFile), { recursive: true })
    await writeFile(updateFile, 'void 0;')
    await writeFile(path.join(root, 'app.js'), 'App({})')
    await writeFile(path.join(root, 'page.wxml'), '<view />')
    const before = await readHmrOutputIdentity(root)

    await writeFile(updateFile, 'applyPatch()')
    await writeFile(path.join(root, 'page.wxml'), '<view style="{{theme}}" />')
    const after = await readHmrOutputIdentity(root)

    expect(after.startupHash).toBe(before.startupHash)
    expect(after.transportHash).not.toBe(before.transportHash)
    expect(after.assetHash).not.toBe(before.assetHash)
    expect(after.files.find(file => file.file === WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE)?.kind).toBe('transport')
  })
})
