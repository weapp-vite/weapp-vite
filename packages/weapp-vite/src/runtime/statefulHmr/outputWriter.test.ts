import { Buffer } from 'node:buffer'
import path from 'node:path'
import { fs } from '@weapp-core/shared/node'
import { afterEach, describe, expect, it } from 'vitest'
import { writeStatefulHmrOutput } from './outputWriter'

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map(root => fs.remove(root)))
})

describe('stateful hmr output writer', () => {
  it('publishes resolved public assets on the initial write without deriving them from the output root', async () => {
    const root = await fs.mkdtemp(path.join(process.cwd(), '.tmp-stateful-hmr-writer-'))
    tempRoots.push(root)
    const appRoot = path.join(root, 'app')
    const publicDir = path.join(appRoot, 'static-assets')
    const outDir = path.join(root, 'artifacts', 'mini', 'dist')
    const icon = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    await fs.outputFile(path.join(publicDir, 'tabbar/icon.png'), icon)
    await fs.outputFile(path.join(appRoot, 'public/wrong-app-root.txt'), 'wrong')
    await fs.outputFile(path.join(path.dirname(outDir), 'public/wrong-output-root.txt'), 'wrong')

    await writeStatefulHmrOutput(outDir, [
      { type: 'asset', fileName: 'app.json', source: '{"tabBar":{"list":[{"iconPath":"tabbar/icon.png"}]}}' },
    ], { publicDir, copyPublicDir: true })

    await expect(fs.readFile(path.join(outDir, 'tabbar/icon.png'))).resolves.toEqual(icon)
    await expect(fs.pathExists(path.join(outDir, 'wrong-app-root.txt'))).resolves.toBe(false)
    await expect(fs.pathExists(path.join(outDir, 'wrong-output-root.txt'))).resolves.toBe(false)
    const previousIcon = await fs.stat(path.join(outDir, 'tabbar/icon.png'))
    await fs.outputFile(path.join(publicDir, 'tabbar/icon.png'), 'changed public source')
    await fs.outputFile(path.join(publicDir, 'unrequested.txt'), 'new public source')

    await writeStatefulHmrOutput(outDir, [
      { type: 'asset', fileName: 'pages/index/index.wxml', source: '<view>updated</view>' },
    ])

    await expect(fs.readFile(path.join(outDir, 'tabbar/icon.png'))).resolves.toEqual(icon)
    expect((await fs.stat(path.join(outDir, 'tabbar/icon.png'))).mtimeMs).toBe(previousIcon.mtimeMs)
    await expect(fs.pathExists(path.join(outDir, 'unrequested.txt'))).resolves.toBe(false)
  })

  it.each(['publicDir', 'copyPublicDir'] as const)('honors disabled %s on the initial publication', async (disabled) => {
    const root = await fs.mkdtemp(path.join(process.cwd(), '.tmp-stateful-hmr-writer-'))
    tempRoots.push(root)
    const publicDir = path.join(root, 'static-assets')
    const outDir = path.join(root, 'dist')
    await fs.outputFile(path.join(publicDir, 'icon.png'), 'configured public icon')
    await fs.outputFile(path.join(root, 'public/implicit.png'), 'implicit public icon')

    await writeStatefulHmrOutput(outDir, [
      { type: 'asset', fileName: 'app.js', source: 'App({})' },
    ], {
      publicDir: disabled === 'publicDir' ? '' : publicDir,
      copyPublicDir: disabled !== 'copyPublicDir',
    })

    await expect(fs.pathExists(path.join(outDir, 'icon.png'))).resolves.toBe(false)
    await expect(fs.pathExists(path.join(outDir, 'implicit.png'))).resolves.toBe(false)
    await expect(fs.readFile(path.join(outDir, 'app.js'), 'utf8')).resolves.toBe('App({})')
  })

  it('preserves Vite emitted-output precedence over colliding initial public files', async () => {
    const root = await fs.mkdtemp(path.join(process.cwd(), '.tmp-stateful-hmr-writer-'))
    tempRoots.push(root)
    const publicDir = path.join(root, 'static-assets')
    const outDir = path.join(root, 'dist')
    await fs.outputFile(path.join(publicDir, 'app.json'), '{"stale":true}')

    await writeStatefulHmrOutput(outDir, [
      { type: 'asset', fileName: 'app.json', source: '{"pages":["pages/index/index"]}' },
    ], { publicDir, copyPublicDir: true })

    await expect(fs.readFile(path.join(outDir, 'app.json'), 'utf8')).resolves.toBe('{"pages":["pages/index/index"]}')
  })

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
