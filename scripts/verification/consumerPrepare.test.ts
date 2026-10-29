import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { expect, it, vi } from 'vitest'
import { prepareConsumerSupport } from './consumerPrepare.ts'

async function fixture(postinstall = 'wv prepare') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'verify-consumer-prepare-'))
  const directory = 'apps/consumer'
  const cwd = path.join(root, directory)
  await mkdir(cwd, { recursive: true })
  await writeFile(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { postinstall } }))
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

it.each([
  ['wv prepare -p weapp', 'weapp'],
  ['weapp-vite prepare --platform alipay', 'alipay'],
  ['wv prepare --platform=tt', 'tt'],
  ['wv prepare -p swan', 'swan'],
  ['wv prepare -p jd', 'jd'],
  ['wv prepare -p xhs', 'xhs'],
  ['wv prepare -p web', 'web'],
])('uses the existing consumer target through the frozen CLI: %s', async (postinstall, platform) => {
  const { root, directory, cwd, config } = await fixture(postinstall)
  try {
    const execute = vi.fn(async () => {
      await mkdir(path.dirname(config), { recursive: true })
      await writeFile(config, '{}')
      return { exitCode: 0 }
    })
    await prepareConsumerSupport(root, directory, 'packages/weapp-vite/bin/weapp-vite.js', execute)
    expect(execute).toHaveBeenCalledExactlyOnceWith(process.execPath, [path.join(root, 'packages/weapp-vite/bin/weapp-vite.js'), 'prepare', '--platform', platform], { cwd, reject: false })
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it.each(['wv prepare -p unknown', 'wv prepare -p weapp && node setup.mjs', 'wv prepare -p $(node platform.mjs)', 'wv prepare -p weapp\nnode setup.mjs'])('rejects unsupported or shell prepare contracts before launching: %s', async (postinstall) => {
  const { root, directory } = await fixture(postinstall)
  const execute = vi.fn()
  try {
    await expect(prepareConsumerSupport(root, directory, 'packages/weapp-vite/bin/weapp-vite.js', execute)).rejects.toThrow('参数无法安全复用')
    expect(execute).not.toHaveBeenCalled()
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('keeps a configured platform under the official CLI when postinstall does not select a target', async () => {
  const { root, directory, cwd, config } = await fixture('node setup.mjs')
  const source = 'export default { weapp: { platform: "alipay" }, build: { outDir: "custom-output" } }'
  try {
    await writeFile(path.join(cwd, 'vite.config.ts'), source)
    const execute = vi.fn(async () => {
      await mkdir(path.dirname(config), { recursive: true })
      await writeFile(config, '{}')
      return { exitCode: 0 }
    })
    await prepareConsumerSupport(root, directory, 'packages/weapp-vite/bin/weapp-vite.js', execute)
    expect(execute).toHaveBeenCalledExactlyOnceWith(process.execPath, [path.join(root, 'packages/weapp-vite/bin/weapp-vite.js'), 'prepare'], { cwd, reject: false })
    expect(await readFile(path.join(cwd, 'vite.config.ts'), 'utf8')).toBe(source)
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
