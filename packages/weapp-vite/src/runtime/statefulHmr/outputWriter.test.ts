import path from 'node:path'
import { fs } from '@weapp-core/shared/node'
import { afterEach, describe, expect, it } from 'vitest'
import { writeStatefulHmrOutput } from './outputWriter'

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map(root => fs.remove(root)))
})

describe('stateful hmr output writer', () => {
  it('does not copy or overwrite public files outside the emitted asset list', async () => {
    const root = await fs.mkdtemp(path.join(process.cwd(), '.tmp-stateful-hmr-writer-'))
    tempRoots.push(root)
    const outDir = path.join(root, 'dist')
    await fs.outputFile(path.join(root, 'public/logo.png'), 'unrequested replacement')
    await fs.outputFile(path.join(root, 'public/extra.png'), 'unrequested new file')
    await fs.outputFile(path.join(outDir, 'logo.png'), 'previously emitted logo')
    const previousLogo = await fs.stat(path.join(outDir, 'logo.png'))

    await writeStatefulHmrOutput(outDir, [
      { type: 'asset', fileName: 'pages/index/index.wxml', source: '<view>updated</view>' },
      { type: 'asset', fileName: 'pages/index/index.wxss', source: 'view { color: red; }' },
    ])

    await expect(fs.readFile(path.join(outDir, 'logo.png'), 'utf8')).resolves.toBe('previously emitted logo')
    expect((await fs.stat(path.join(outDir, 'logo.png'))).mtimeMs).toBe(previousLogo.mtimeMs)
    await expect(fs.pathExists(path.join(outDir, 'extra.png'))).resolves.toBe(false)
    await expect(fs.readFile(path.join(outDir, 'pages/index/index.wxml'), 'utf8')).resolves.toBe('<view>updated</view>')
    await expect(fs.readFile(path.join(outDir, 'pages/index/index.wxss'), 'utf8')).resolves.toBe('view { color: red; }')
  })

  it('persists generated files through Vite write without deleting partial output', async () => {
    const root = await fs.mkdtemp(path.join(process.cwd(), '.tmp-stateful-hmr-writer-'))
    tempRoots.push(root)
    const outDir = path.join(root, 'dist')
    await fs.outputFile(path.join(outDir, 'keep.js'), 'keep')

    await writeStatefulHmrOutput(outDir, [
      { type: 'asset', fileName: 'app.js', source: 'App({})' },
      { type: 'asset', fileName: '__weapp_vite_hmr/update.js', source: 'void 0;' },
    ])

    await expect(fs.readFile(path.join(outDir, 'app.js'), 'utf8')).resolves.toBe('App({})')
    await expect(fs.readFile(path.join(outDir, '__weapp_vite_hmr/update.js'), 'utf8')).resolves.toBe('void 0;')
    await expect(fs.readFile(path.join(outDir, 'keep.js'), 'utf8')).resolves.toBe('keep')
  })
})
