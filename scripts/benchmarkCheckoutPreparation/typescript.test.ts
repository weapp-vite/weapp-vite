import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { assertBenchmarkPrepareCompleted, assertBenchmarkTypeScriptPrepared, createBenchmarkPrepareArgs, discoverBenchmarkTypeScriptProjects } from './typescript'

const roots: string[] = []

async function fixture(files: Record<string, unknown>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'benchmark-prepare-'))
  roots.push(root)
  for (const [file, value] of Object.entries(files)) {
    const target = path.join(root, file)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, typeof value === 'string' ? value : JSON.stringify(value))
  }
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('benchmark TypeScript reference preparation', () => {
  it('uses the checkout CLI and the same explicit platform as the benchmark', () => {
    expect(createBenchmarkPrepareArgs('apps/multi-platform')).toEqual([
      'packages/weapp-vite/bin/weapp-vite.js',
      'prepare',
      'apps/multi-platform',
      '--platform',
      'weapp',
    ])
  })

  it('requires CLI completion even when skipped preparation exits zero and old files exist', () => {
    expect(() => assertBenchmarkPrepareCompleted('apps/example', { exitCode: 0, output: '\u001B[32mℹ 已生成 .weapp-vite 支持文件。\u001B[0m\r\n' })).not.toThrow()
    expect(() => assertBenchmarkPrepareCompleted('apps/example', {
      exitCode: 0,
      output: 'WARN [prepare] 原生配置加载失败，已回退到 runner\nℹ 已生成 .weapp-vite 支持文件。',
    })).not.toThrow()
    for (const output of ['', 'WARN [prepare] 跳过 .weapp-vite 支持文件预生成：请指定目标平台', '已生成 .weapp-vite 支持文件。\nWARN [prepare] skipped']) {
      expect(() => assertBenchmarkPrepareCompleted('apps/example', { exitCode: 0, output })).toThrow('preparation did not complete')
    }
    expect(() => assertBenchmarkPrepareCompleted('apps/example', { exitCode: 1, output: '已生成 .weapp-vite 支持文件。' })).toThrow('preparation did not complete')
  })

  it('discovers unselected applications through references and extends without reading missing generated files', async () => {
    const root = await fixture({
      'tsconfig.json': { references: [{ path: 'apps\\unselected' }, { path: 'packages/group/tsconfig.json' }] },
      'apps/unselected/tsconfig.json': '// normal JSONC configuration\r\n{"extends":"./.weapp-vite/tsconfig.shared.json",}',
      'packages/group/tsconfig.json': { references: [{ path: '../../templates/plugin' }, { path: '../../apps/unselected' }] },
      'templates/plugin/tsconfig.json': { references: [{ path: './.weapp-vite/tsconfig.app.json' }, { path: './.weapp-vite/tsconfig.node.json' }] },
    })
    expect(await discoverBenchmarkTypeScriptProjects(root)).toEqual([
      { root: 'apps/unselected', supportFiles: ['apps/unselected/.weapp-vite/tsconfig.shared.json'] },
      { root: 'templates/plugin', supportFiles: ['templates/plugin/.weapp-vite/tsconfig.app.json', 'templates/plugin/.weapp-vite/tsconfig.node.json'] },
    ])
  })

  it('handles reference cycles and local extends arrays while ignoring package extends', async () => {
    const root = await fixture({
      'tsconfig.json': { references: [{ path: './app' }] },
      'app/tsconfig.json': { extends: ['@shared/tsconfig', '../configs/base'], references: [{ path: '..' }] },
      'configs/base.json': { extends: '../app/.weapp-vite/tsconfig.shared.json' },
    })
    expect(await discoverBenchmarkTypeScriptProjects(root)).toEqual([
      { root: 'app', supportFiles: ['app/.weapp-vite/tsconfig.shared.json'] },
    ])
  })

  it('rejects unsuccessful preparation before any measurement instead of accepting a warning exit', async () => {
    const root = await fixture({
      'tsconfig.json': { references: [{ path: './app/.weapp-vite/tsconfig.app.json' }] },
    })
    const projects = await discoverBenchmarkTypeScriptProjects(root)
    await expect(assertBenchmarkTypeScriptPrepared(root, projects)).rejects.toThrow('TypeScript support file missing after prepare: app/.weapp-vite/tsconfig.app.json')
    await mkdir(path.join(root, 'app/.weapp-vite'), { recursive: true })
    await writeFile(path.join(root, 'app/.weapp-vite/tsconfig.app.json'), '{}')
    await expect(assertBenchmarkTypeScriptPrepared(root, projects)).resolves.toBeUndefined()
  })

  it('does not silently omit malformed or outside-checkout references', async () => {
    const malformed = await fixture({ 'tsconfig.json': { references: [{ path: 123 }] } })
    await expect(discoverBenchmarkTypeScriptProjects(malformed)).rejects.toThrow('Invalid TypeScript reference in tsconfig.json')
    const invalidList = await fixture({ 'tsconfig.json': { references: 'app' } })
    await expect(discoverBenchmarkTypeScriptProjects(invalidList)).rejects.toThrow('Invalid TypeScript references in tsconfig.json')
    const outside = await fixture({ 'tsconfig.json': { references: [{ path: '../outside' }] } })
    await expect(discoverBenchmarkTypeScriptProjects(outside)).rejects.toThrow('TypeScript reference leaves benchmark checkout')
  })
})
