import type { CompilerContext } from '../../context'
import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { setTimeout as delay } from 'node:timers/promises'
import path from 'pathe'
import { expect, it, vi } from 'vitest'
import { watchAssetSources } from './assets'

it('owns copy updates and directory recovery without claiming editor files or imported modules', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'asset-watch-'))
  const src = path.join(root, 'src')
  await mkdir(src)
  const image = path.join(src, 'image.png')
  const dynamic = path.join(src, 'dynamic.txt')
  await writeFile(image, 'before')
  await writeFile(dynamic, 'exclude')
  const changed = vi.fn()
  const errors = vi.fn()
  const config = {
    cwd: root,
    absoluteSrcRoot: src,
    outDir: path.join(root, 'dist'),
    inlineConfig: { server: { watch: { usePolling: true, interval: 20, binaryInterval: 20 } } },
    weappViteConfig: { copy: {
      include: ['**/*.txt'],
      exclude: ['**/excluded.txt', 'nested'],
      filter: (file: string) => !file.endsWith('dynamic.txt') || readFileSync(file, 'utf8') !== 'exclude',
    } },
  } as unknown as CompilerContext['configService']
  const watcher = watchAssetSources(config, {
    onChange: changed,
    onError: errors,
    isModule: file => file.endsWith('imported.png'),
  })
  try {
    await watcher.ready
    expect(changed).not.toHaveBeenCalled()
    await writeFile(image, 'after')
    await vi.waitFor(() => expect(changed).toHaveBeenCalledWith(image, 'update'))
    await writeFile(dynamic, 'now included')
    await vi.waitFor(() => expect(changed).toHaveBeenCalledWith(dynamic, 'create'))
    await writeFile(dynamic, 'exclude')
    await vi.waitFor(() => expect(changed).toHaveBeenCalledWith(dynamic, 'delete'))
    const nested = path.join(src, 'nested/new.txt')
    await mkdir(path.dirname(nested))
    await writeFile(nested, 'created')
    await vi.waitFor(() => expect(changed).toHaveBeenCalledWith(nested, 'create'))
    await rm(path.dirname(nested), { recursive: true })
    await vi.waitFor(() => expect(changed).toHaveBeenCalledWith(nested, 'delete'))
    changed.mockClear()
    await mkdir(path.dirname(nested))
    await writeFile(nested, 'restored')
    await vi.waitFor(() => expect(changed).toHaveBeenCalledWith(nested, 'create'))
    changed.mockClear()
    for (const file of ['buffer.note', '.buffer', 'excluded.txt', 'imported.png']) {
      await writeFile(path.join(src, file), 'ignored')
    }
    await delay(150)
    expect(changed).not.toHaveBeenCalled()
    expect(errors).not.toHaveBeenCalled()
    expect(await readFile(nested, 'utf8')).toBe('restored')
  }
  finally {
    await watcher.close()
    await rm(root, { recursive: true, force: true })
  }
})

it('reports filter failures without dropping the last accepted ownership and can recover on a later event', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'asset-watch-error-'))
  const src = path.join(root, 'src')
  await mkdir(src)
  const image = path.join(src, 'image.png')
  await writeFile(image, 'before')
  let reject = false
  const config = {
    cwd: root,
    absoluteSrcRoot: src,
    outDir: path.join(root, 'dist'),
    inlineConfig: { server: { watch: { usePolling: true, interval: 20, binaryInterval: 20 } } },
    weappViteConfig: { copy: { filter: () => {
      if (reject) {
        throw new Error('copy selector failed')
      }
      return true
    } } },
  } as unknown as CompilerContext['configService']
  const onError = vi.fn()
  const onChange = vi.fn()
  const watcher = watchAssetSources(config, { onChange, onError })
  try {
    await watcher.ready
    reject = true
    await writeFile(image, 'failed update')
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'copy selector failed' })))
    expect(onChange).not.toHaveBeenCalled()
    reject = false
    // 这是后续独立事件，避开 chokidar 固有的 change 合并窗口；不改变生产监听节奏。
    await delay(100)
    await writeFile(image, 'recovered update')
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(image, 'update'))
  }
  finally {
    await watcher.close()
    await rm(root, { recursive: true, force: true })
  }
})
