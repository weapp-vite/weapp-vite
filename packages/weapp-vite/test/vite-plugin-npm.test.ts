import type { InlineConfig } from 'vite'
import { mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build, normalizePath } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { weapp } from '../src/vite'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-native-npm-')))
  roots.push(root)
  const files = {
    'package.json': JSON.stringify({ type: 'module', dependencies: { 'mini-card': '1.0.0', 'plain-value': '1.0.0', 'skip-value': '1.0.0' } }),
    'project.config.json': JSON.stringify({ miniprogramRoot: 'dist' }),
    'src/app.ts': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/home/index'] }),
    'src/pages/home/index.ts': 'Page({})',
    'src/pages/home/index.json': '{}',
    'src/pages/home/index.wxml': '<view>npm host</view>',
    'node_modules/mini-card/package.json': JSON.stringify({ name: 'mini-card', version: '1.0.0', main: 'miniprogram/index.js', miniprogram: 'miniprogram' }),
    'node_modules/mini-card/miniprogram/index.js': 'Component({})',
    'node_modules/mini-card/miniprogram/index.json': '{"component":true}',
    'node_modules/mini-card/miniprogram/index.wxml': '<view>native card</view>',
    'node_modules/plain-value/package.json': JSON.stringify({ name: 'plain-value', version: '1.0.0', main: 'index.js' }),
    'node_modules/plain-value/index.js': 'export const value = NPM_MESSAGE',
    'node_modules/skip-value/package.json': JSON.stringify({ name: 'skip-value', version: '1.0.0', main: 'index.js' }),
    'node_modules/skip-value/index.js': 'throw new Error("must be skipped")',
  }
  for (const [file, source] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), source)
  }
  const config: InlineConfig = {
    root,
    configFile: false,
    plugins: [weapp()],
    logLevel: 'silent',
    weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false, npm: { enable: true, strategy: 'legacy' } },
    build: { outDir: 'dist', minify: false },
  }
  return { root, config }
}

describe('native host npm customization', () => {
  it('resolves callbacks against final paths, captures native/bundled output and supports skipped packages', async () => {
    const { root, config } = await fixture()
    const callback = vi.fn((options, meta) => {
      expect(options.build.outDir).toBe(normalizePath(path.join(root, 'dist/miniprogram_npm', meta.name)))
      if (meta.name === 'skip-value') {
        return false
      }
      if (meta.name === 'mini-card') {
        options.build.outDir = 'dist/custom-card'
      }
      options.define.NPM_MESSAGE = JSON.stringify('custom npm value')
      options.build.sourcemap = true
      return options
    })
    config.weapp!.npm!.buildOptions = callback
    const emitted: string[] = []
    config.plugins!.push({ name: 'observe-npm', writeBundle(_options, bundle) {
      emitted.push(...Object.keys(bundle))
    } })
    await build(config)
    expect(callback).toHaveBeenCalledTimes(3)
    expect(emitted).toContain('custom-card/index.wxml')
    expect(emitted).toContain('miniprogram_npm/plain-value/index.js')
    expect(await readFile(path.join(root, 'dist/miniprogram_npm/plain-value/index.js'), 'utf8')).toContain('custom npm value')
    const map = JSON.parse(await readFile(path.join(root, 'dist/miniprogram_npm/plain-value/index.js.map'), 'utf8')) as { sources: string[] }
    expect(map.sources.some(source => path.resolve(root, 'dist/miniprogram_npm/plain-value', source) === path.join(root, 'node_modules/plain-value/index.js'))).toBe(true)
    await expect(stat(path.join(root, 'dist/miniprogram_npm/skip-value'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('uses the manual package manifest and publishes mapped directories while preserving unrelated files', async () => {
    const { root, config } = await fixture()
    await mkdir(path.join(root, 'npm-config'), { recursive: true })
    await writeFile(path.join(root, 'npm-config/package.json'), JSON.stringify({ dependencies: { 'mini-card': '1.0.0', 'plain-value': '1.0.0' } }))
    config.weapp!.npm!.buildOptions = (options) => {
      options.build!.sourcemap = true
      options.define = { ...options.define, NPM_MESSAGE: JSON.stringify('manual source') }
      return options
    }
    await writeFile(path.join(root, 'project.config.json'), JSON.stringify({
      miniprogramRoot: 'dist',
      setting: { packNpmManually: true, packNpmRelationList: [
        { packageJsonPath: 'npm-config/package.json', miniprogramNpmDistDir: 'dist/manual' },
        { packageJsonPath: 'npm-config/package.json', miniprogramNpmDistDir: 'secondary' },
      ] },
    }))
    await mkdir(path.join(root, 'secondary/miniprogram_npm'), { recursive: true })
    await writeFile(path.join(root, 'secondary/miniprogram_npm/user-owned.txt'), 'keep')
    await build(config)
    for (const folder of ['dist/manual', 'secondary']) {
      expect(await readFile(path.join(root, folder, 'miniprogram_npm/mini-card/index.wxml'), 'utf8')).toContain('native card')
      await expect(stat(path.join(root, folder, 'miniprogram_npm/skip-value'))).rejects.toMatchObject({ code: 'ENOENT' })
      const mapRoot = path.join(root, folder, 'miniprogram_npm/plain-value')
      const map = JSON.parse(await readFile(path.join(mapRoot, 'index.js.map'), 'utf8')) as { sources: string[] }
      expect(map.sources.some(source => path.resolve(mapRoot, source) === path.join(root, 'node_modules/plain-value/index.js'))).toBe(true)
    }
    expect(await readFile(path.join(root, 'secondary/miniprogram_npm/user-owned.txt'), 'utf8')).toBe('keep')
    await writeFile(path.join(root, 'npm-config/package.json'), JSON.stringify({ dependencies: {} }))
    await build({ ...config, plugins: [weapp()] })
    await expect(stat(path.join(root, 'secondary/miniprogram_npm/mini-card/index.wxml'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(path.join(root, 'secondary/miniprogram_npm/user-owned.txt'), 'utf8')).toBe('keep')
  })

  it.each(['explicit', 'legacy'] as const)('resolves manual dependency roots and native children with the %s strategy', async (strategy) => {
    const { root, config } = await fixture()
    const packages = [
      { folder: 'npm-config/node_modules/nested-card', name: 'nested-card', marker: 'nested only', dependencies: { 'nested-child': '1.0.0' } },
      { folder: 'npm-config/node_modules/nested-card/node_modules/nested-child', name: 'nested-child', marker: 'native child' },
      { folder: 'npm-config/node_modules/mini-card', name: 'mini-card', marker: 'nearest package' },
      { folder: 'node_modules/root-card', name: 'root-card', marker: 'ancestor package' },
    ]
    for (const pkg of packages) {
      const target = path.join(root, pkg.folder)
      await mkdir(path.join(target, 'miniprogram'), { recursive: true })
      await writeFile(path.join(target, 'package.json'), JSON.stringify({ name: pkg.name, version: '1.0.0', miniprogram: 'miniprogram', dependencies: pkg.dependencies }))
      await writeFile(path.join(target, 'miniprogram/index.js'), 'Component({})')
      await writeFile(path.join(target, 'miniprogram/index.json'), '{"component":true}')
      await writeFile(path.join(target, 'miniprogram/index.wxml'), `<view>${pkg.marker}</view>`)
    }
    await writeFile(path.join(root, 'npm-config/package.json'), JSON.stringify({ dependencies: { 'nested-card': '1.0.0', 'mini-card': '1.0.0', 'root-card': '1.0.0' } }))
    await writeFile(path.join(root, 'project.config.json'), JSON.stringify({
      miniprogramRoot: 'dist',
      setting: { packNpmManually: true, packNpmRelationList: [
        { packageJsonPath: 'npm-config/package.json', miniprogramNpmDistDir: 'dist/manual' },
      ] },
    }))
    config.weapp!.npm!.strategy = strategy
    config.weapp!.npm!.buildOptions = (options, meta) => {
      expect(options.root).toBe(normalizePath(root))
      expect(options.build!.outDir).toBe(normalizePath(path.join(root, 'dist/manual/miniprogram_npm', meta.name)))
      return options
    }
    await build(config)
    for (const pkg of packages) {
      const target = path.join(root, 'dist/manual/miniprogram_npm', pkg.name)
      expect(await readFile(path.join(target, 'index.wxml'), 'utf8')).toContain(pkg.marker)
      for (const extension of ['js', 'json']) {
        await expect(stat(path.join(target, `index.${extension}`))).resolves.toBeTruthy()
      }
    }
  })

  it('dereferences linked native resources into staging before publishing them', async () => {
    const { root, config } = await fixture()
    const linkedSource = path.join(root, 'shared-native')
    await mkdir(linkedSource)
    await writeFile(path.join(linkedSource, 'asset.txt'), 'linked content')
    await symlink(linkedSource, path.join(root, 'node_modules/mini-card/miniprogram/linked'), 'junction')
    // Windows 文件符号链接需要额外权限；目录 junction 仍覆盖各平台相同的解引用边界。
    if (process.platform !== 'win32') {
      await symlink(path.join(linkedSource, 'asset.txt'), path.join(root, 'node_modules/mini-card/miniprogram/linked-file.txt'))
    }
    config.weapp!.npm!.buildOptions = (options, meta) => meta.name === 'mini-card' ? options : false
    await build(config)
    expect(await readFile(path.join(root, 'dist/miniprogram_npm/mini-card/linked/asset.txt'), 'utf8')).toBe('linked content')
    if (process.platform !== 'win32') {
      expect(await readFile(path.join(root, 'dist/miniprogram_npm/mini-card/linked-file.txt'), 'utf8')).toBe('linked content')
    }
    expect(await readFile(path.join(linkedSource, 'asset.txt'), 'utf8')).toBe('linked content')
  })

  it('preserves files whose ownership moves from a mirror root to a nested callback directory', async () => {
    const { root, config } = await fixture()
    config.weapp!.npm!.buildOptions = (options, meta) => {
      options.define = { ...options.define, NPM_MESSAGE: JSON.stringify('previous mirror') }
      return meta.name === 'skip-value' ? false : options
    }
    await writeFile(path.join(root, 'project.config.json'), JSON.stringify({
      miniprogramRoot: 'dist',
      setting: { packNpmManually: true, packNpmRelationList: [
        { packageJsonPath: 'package.json', miniprogramNpmDistDir: 'dist' },
        { packageJsonPath: 'package.json', miniprogramNpmDistDir: 'secondary' },
      ] },
    }))
    await build(config)
    const externalRoot = path.join(root, 'secondary/miniprogram_npm')
    expect(await readFile(path.join(externalRoot, 'mini-card/index.wxml'), 'utf8')).toContain('native card')
    expect(await readFile(path.join(externalRoot, 'plain-value/index.js'), 'utf8')).toContain('previous mirror')
    await writeFile(path.join(externalRoot, 'user-owned.txt'), 'keep')
    await writeFile(path.join(root, 'project.config.json'), JSON.stringify({ miniprogramRoot: 'dist' }))
    await writeFile(path.join(root, 'node_modules/mini-card/miniprogram/index.wxml'), '<view>updated native card</view>')
    config.weapp!.npm!.buildOptions = (options, meta) => {
      if (meta.name !== 'mini-card') {
        return false
      }
      options.build!.outDir = 'secondary/miniprogram_npm/mini-card'
      return options
    }
    await build({ ...config, plugins: [weapp()] })
    expect(await readFile(path.join(externalRoot, 'mini-card/index.wxml'), 'utf8')).toContain('updated native card')
    for (const extension of ['js', 'json']) {
      await expect(stat(path.join(externalRoot, `mini-card/index.${extension}`))).resolves.toBeTruthy()
    }
    await expect(stat(path.join(externalRoot, 'plain-value/index.js'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(path.join(externalRoot, 'user-owned.txt'), 'utf8')).toBe('keep')
    // 再撤销子目录归属，确认记录已推进且仅删除当前构建拥有的文件。
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ type: 'module', dependencies: {} }))
    await build({ ...config, plugins: [weapp()] })
    await expect(stat(path.join(externalRoot, 'mini-card/index.wxml'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(path.join(externalRoot, 'user-owned.txt'), 'utf8')).toBe('keep')
  })

  it('forgets stale external ownership when its output root was already removed', async () => {
    const { root, config } = await fixture()
    config.weapp!.npm!.buildOptions = (options, meta) => {
      if (meta.name !== 'mini-card') {
        return false
      }
      options.build!.outDir = 'external-card'
      return options
    }
    await build(config)
    expect(await readFile(path.join(root, 'external-card/index.wxml'), 'utf8')).toContain('native card')
    await rm(path.join(root, 'external-card'), { recursive: true })
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ type: 'module', dependencies: {} }))
    await build({ ...config, plugins: [weapp()] })
    await expect(stat(path.join(root, 'external-card/index.wxml'))).rejects.toMatchObject({ code: 'ENOENT' })
    // 第二次独立构建不应继续携带已撤销的外部输出归属。
    await build({ ...config, plugins: [weapp()] })
  })

  it('keeps customized npm output in memory when build.write is false', async () => {
    const { root, config } = await fixture()
    config.weapp!.npm!.buildOptions = (options, meta) => {
      if (meta.name !== 'mini-card') {
        return false
      }
      options.build!.outDir = 'dist/in-memory-card'
      return options
    }
    config.build!.write = false
    const result = await build(config)
    expect('output' in result && result.output.some(item => item.fileName === 'in-memory-card/index.wxml')).toBe(true)
    await expect(stat(path.join(root, 'dist'))).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
