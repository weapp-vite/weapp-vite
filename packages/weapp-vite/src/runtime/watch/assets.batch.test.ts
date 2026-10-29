import type { CompilerContext } from '../../context'
import type { FileWatchChange } from './fileWatcher'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { expect, it, vi } from 'vitest'
import { watchAssetSources } from './assets'

const backend = vi.hoisted(() => ({
  onChange: undefined as ((changes: FileWatchChange[]) => void) | undefined,
}))

vi.mock('./fileWatcher', () => ({
  createFileWatcher: () => ({
    ready: Promise.resolve('ready'),
    onChange(listener: (changes: FileWatchChange[]) => void) {
      backend.onChange = listener
      return () => {}
    },
    onError: () => () => {},
    close: async () => {},
  }),
}))

it('scans each delivered asset batch once and publishes each created file once', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'asset-batch-'))
  const src = path.join(root, 'src')
  const existing = path.join(src, 'existing.png')
  const first = path.join(src, 'first.png')
  const second = path.join(src, 'second.png')
  await mkdir(src)
  await writeFile(existing, 'before')
  const filter = vi.fn(() => true)
  const onError = vi.fn()
  const drained = Promise.withResolvers<void>()
  const onChange = vi.fn((file: string) => {
    if (file === existing) {
      drained.resolve()
    }
  })
  const config = {
    cwd: root,
    absoluteSrcRoot: src,
    outDir: path.join(root, 'dist'),
    inlineConfig: {},
    weappViteConfig: { copy: { filter } },
  } as unknown as CompilerContext['configService']
  const watcher = watchAssetSources(config, { onChange, onError })
  try {
    await watcher.ready
    filter.mockClear()
    await writeFile(first, 'one')
    await writeFile(second, 'two')
    backend.onChange!([
      { event: 'create', file: first, kind: 'file' },
      { event: 'create', file: second, kind: 'file' },
    ])
    // 后续独立批次作为排空屏障，确保首次批次的所有扫描与通知均已处理。
    backend.onChange!([{ event: 'update', file: existing, kind: 'file' }])
    await drained.promise

    expect(filter).toHaveBeenCalledTimes(6)
    expect(onChange).toHaveBeenCalledTimes(3)
    expect(onChange).toHaveBeenCalledWith(first, 'create')
    expect(onChange).toHaveBeenCalledWith(second, 'create')
    expect(onChange).toHaveBeenCalledWith(existing, 'update')
    expect(onError).not.toHaveBeenCalled()
  }
  finally {
    await watcher.close()
    await rm(root, { recursive: true, force: true })
  }
})
