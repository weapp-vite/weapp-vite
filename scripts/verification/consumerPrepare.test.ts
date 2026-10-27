import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { expect, it, vi } from 'vitest'
import { prepareConsumerSupport } from './consumerPrepare.ts'

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'verify-consumer-prepare-'))
  const directory = 'apps/consumer'
  const cwd = path.join(root, directory)
  await mkdir(cwd, { recursive: true })
  const config = path.join(cwd, '.weapp-vite/tsconfig.app.json')
  return { root, directory, cwd, config }
}

it('calls the frozen official CLI from the owned consumer and accepts generated support', async () => {
  const { root, directory, cwd, config } = await fixture()
  try {
    const execute = vi.fn(async () => {
      await mkdir(path.dirname(config), { recursive: true })
      await writeFile(config, JSON.stringify({ compilerOptions: {} }))
      return { exitCode: 0 }
    })
    await prepareConsumerSupport(root, directory, 'packages/weapp-vite/bin/weapp-vite.js', execute)
    expect(execute).toHaveBeenCalledExactlyOnceWith(process.execPath, [path.join(root, 'packages/weapp-vite/bin/weapp-vite.js'), 'prepare'], { cwd, reject: false })
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it.each(['missing', 'invalid', 'array'])('rejects successful prepare without valid support: %s', async (kind) => {
  const { root, directory, config } = await fixture()
  try {
    if (kind !== 'missing') {
      await mkdir(path.dirname(config), { recursive: true })
      await writeFile(config, kind === 'array' ? '[]' : 'invalid json')
    }
    await expect(prepareConsumerSupport(root, directory, 'packages/weapp-vite/bin/weapp-vite.js', async () => ({ exitCode: 0 }))).rejects.toThrow()
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it.each(['stdout', 'stderr'] as const)('rejects swallowed prepare failure in %s even when stale support exists', async (stream) => {
  const { root, directory, config } = await fixture()
  const output = vi.spyOn(process[stream], 'write').mockImplementation(() => true)
  try {
    await mkdir(path.dirname(config), { recursive: true })
    await writeFile(config, '{}')
    await expect(prepareConsumerSupport(root, directory, 'packages/weapp-vite/bin/weapp-vite.js', async () => ({ exitCode: 0, [stream]: '跳过 .weapp-vite 支持文件预生成：CLI 尚未构建' }))).rejects.toThrow('跳过生成')
  }
  finally {
    output.mockRestore()
    await rm(root, { recursive: true, force: true })
  }
})

it('rejects failed CLI execution before checking stale generated files', async () => {
  const { root, directory, config } = await fixture()
  try {
    await mkdir(path.dirname(config), { recursive: true })
    await writeFile(config, '{}')
    await expect(prepareConsumerSupport(root, directory, 'packages/weapp-vite/bin/weapp-vite.js', async () => ({ exitCode: 1 }))).rejects.toThrow('命令未通过')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
