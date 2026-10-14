import type { OutputAsset, OutputChunk } from 'rolldown'
import type { InlineConfig, ViteDevServer } from 'vite'
import { Buffer } from 'node:buffer'
import { EventEmitter } from 'node:events'
import { cp, mkdir, mkdtemp, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createCompilerContextInstance } from '../../context/createCompilerContextInstance'
import { createCompilerDependencyTracker } from '../../plugins/compilerPlugin/dependencies'
import { CompilerHmrResyncError, getCompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import { buildStatefulHmrSnapshot } from './snapshotBuild'

async function fixture(filename: string, frozen: string | Buffer, query = '', useAlias = false) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'snapshot-asset-boundary-')))
  const owner = createCompilerContextInstance()
  const physical = path.join(root, 'assets-physical')
  const replacement = path.join(root, 'assets-replacement')
  const alias = path.join(root, 'asset-alias')
  const file = path.join(useAlias ? physical : path.join(root, 'src'), filename)
  const imported = useAlias ? path.join(alias, filename) : file
  try {
    const files = {
      'package.json': JSON.stringify({ name: 'snapshot-asset-boundary', private: true, type: 'module' }),
      'project.config.json': JSON.stringify({ appid: 'wxb3d842a4a7e3440d', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
      'vite.config.ts': [
        `import { defineConfig } from ${JSON.stringify(path.resolve(import.meta.dirname, '../../config.ts'))}`,
        `export default defineConfig({ assetsInclude: ${JSON.stringify(useAlias ? ['**/assets-physical/*.asset'] : ['**/*.asset'])}, build: { assetsInlineLimit: 0, minify: false }, weapp: { srcRoot: "src", autoRoutes: false, vue: { enable: false }, npm: { enable: false } } })`,
      ].join('\n'),
      'src/app.ts': `import asset from ${JSON.stringify(`${useAlias ? '../asset-alias/' : './'}${filename}${query}`)}; import "./utility"; App({ data: { asset } })`,
      'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
      'src/pages/index/index.ts': 'Page({})',
      'src/pages/index/index.json': '{}',
      'src/pages/index/index.wxml': '<view>asset boundary</view>',
      'src/utility.ts': 'console.log("FUTURE-UTILITY")',
    }
    for (const [relative, source] of Object.entries(files)) {
      const target = path.join(root, relative)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, source)
    }
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, frozen)
    await mkdir(replacement)
    if (useAlias) {
      await symlink(physical, alias, 'junction')
    }
    await mkdir(path.join(root, 'node_modules'))
    await symlink(path.resolve(import.meta.dirname, '../../..'), path.join(root, 'node_modules/weapp-vite'), 'junction')
    const options = { cwd: root, isDev: true, mode: 'development' }
    await owner.configService.load(options)
    const host = getCompilerHmrHost(owner)
    host.captureNative(path.join(root, 'src/utility.ts'), 'console.log("PINNED-UTILITY")')
    return {
      root,
      owner,
      host,
      options,
      file,
      imported,
      physical,
      replacement,
      alias,
      async close() {
        owner.moduleGraphService.resetSession()
        await rm(root, { recursive: true, force: true })
      },
    }
  }
  catch (error) {
    owner.moduleGraphService.resetSession()
    await rm(root, { recursive: true, force: true })
    throw error
  }
}

function outputs(result: Awaited<ReturnType<typeof buildStatefulHmrSnapshot>>): Array<OutputAsset | OutputChunk> {
  return Array.isArray(result.output) ? result.output.flatMap(item => item.output) : 'output' in result.output ? result.output.output : []
}

it.each(['raw', 'url'])('rejects future bytes for an observed text input consumed by real Vite ?%s', async (query) => {
  const app = await fixture('message.txt', 'FROZEN-QUERY-TEXT', `?${query}`)
  try {
    app.host.seed(app.file, 'FROZEN-QUERY-TEXT')
    const input = app.host.freeze([])
    await writeFile(app.file, 'FUTURE-QUERY-TEXT')
    await expect(buildStatefulHmrSnapshot(app.options, undefined, app.owner, input.sources)).rejects.toBeInstanceOf(CompilerHmrResyncError)
  }
  finally {
    await app.close()
  }
})

it.each(['raw', 'url'])('preserves the real Vite loader for unchanged observed text ?%s', async (query) => {
  const app = await fixture('message.txt', 'FROZEN-QUERY-TEXT', `?${query}`)
  try {
    app.host.seed(app.file, 'FROZEN-QUERY-TEXT')
    const result = outputs(await buildStatefulHmrSnapshot(app.options, undefined, app.owner, app.host.freeze([]).sources))
    const scripts = result.flatMap(item => item.type === 'chunk' ? [item.code] : []).join('\n')
    if (query === 'raw') {
      expect(scripts).toContain('FROZEN-QUERY-TEXT')
    }
    else {
      const asset = result.find((item): item is OutputAsset => item.type === 'asset' && item.fileName.endsWith('.txt'))
      expect(asset).toBeDefined()
      expect(Buffer.from(asset!.source).toString()).toBe('FROZEN-QUERY-TEXT')
      expect(scripts).toContain(asset!.fileName)
    }
    expect(scripts).toContain('PINNED-UTILITY')
    expect(scripts).not.toContain('FUTURE-UTILITY')
  }
  finally {
    await app.close()
  }
})

it.each(['raw', 'url'])('rejects a known canonical query path replaced by a junction for ?%s', async (query) => {
  const app = await fixture('message.txt', 'FROZEN-CANONICAL-TEXT', `?${query}`)
  try {
    app.host.seed(app.file, 'FROZEN-CANONICAL-TEXT')
    const input = app.host.freeze([])
    const source = path.join(app.root, 'src')
    await cp(source, app.replacement, { recursive: true })
    await writeFile(path.join(app.replacement, 'message.txt'), 'FUTURE-CANONICAL-TEXT')
    await rm(source, { recursive: true })
    await symlink(app.replacement, source, 'junction')
    await expect(buildStatefulHmrSnapshot(app.options, undefined, app.owner, input.sources)).rejects.toBeInstanceOf(CompilerHmrResyncError)
  }
  finally {
    await app.close()
  }
})

it.each([
  ['message.txt', '?raw', 'before-build'],
  ['message.txt', '?url', 'before-build'],
  ['message.txt', '?raw', 'retarget-revert'],
  ['design.asset', '', 'before-build'],
  ['design.asset', '', 'during-build'],
] as const)('rejects frozen alias %s%s after %s with the old physical input still present', async (filename, query, stage) => {
  const app = await fixture(filename, 'FROZEN-ALIAS-BYTES', query, true)
  try {
    app.host.seed(app.imported, 'FROZEN-ALIAS-BYTES')
    const input = app.host.freeze([])
    await writeFile(path.join(app.replacement, filename), 'FUTURE-ALIAS-BYTES')
    const retarget = async () => {
      await unlink(app.alias)
      await symlink(app.replacement, app.alias, 'junction')
    }
    if (stage !== 'during-build') {
      await retarget()
      if (stage === 'retarget-revert') {
        await unlink(app.alias)
        await symlink(app.physical, app.alias, 'junction')
      }
    }
    // buildEnd 只改变已登记 alias，原 physical 文件内容和版本保持不变。
    const configure = stage === 'during-build'
      ? (config: InlineConfig) => ({ ...config, plugins: [...(config.plugins ?? []), { name: 'alias-version-race', buildEnd: retarget }] })
      : undefined
    await expect(buildStatefulHmrSnapshot(app.options, configure, app.owner, input.sources)).rejects.toBeInstanceOf(CompilerHmrResyncError)
  }
  finally {
    await app.close()
  }
})

it('recovers real binary asset emission after change and deletion with receipts from its dependency watcher', async () => {
  const app = await fixture('binary.asset', Buffer.from([255]))
  const tracker = createCompilerDependencyTracker(app.owner)
  const watcher = new EventEmitter()
  try {
    tracker.remember(app.file)
    tracker.configureServer({ watcher } as unknown as ViteDevServer)
    const oldInput = app.host.freeze([])
    await writeFile(app.file, Buffer.from([254]))
    await expect(buildStatefulHmrSnapshot(app.options, undefined, app.owner, oldInput.sources)).rejects.toBeInstanceOf(CompilerHmrResyncError)
    watcher.emit('change', app.file)
    const current = outputs(await buildStatefulHmrSnapshot(app.options, undefined, app.owner, app.host.freeze([]).sources))
    const currentAsset = current.find((item): item is OutputAsset => item.type === 'asset' && item.fileName.endsWith('.asset'))
    expect(currentAsset).toBeDefined()
    expect(Buffer.from(currentAsset!.source)).toEqual(Buffer.from([254]))
    await unlink(app.file)
    watcher.emit('unlink', app.file)
    const removed = app.host.freeze([])
    await writeFile(app.file, Buffer.from([253]))
    // 已删除的旧账本不能借磁盘恢复绕过；add 的真实读取生成下一份有效账本。
    await expect(buildStatefulHmrSnapshot(app.options, undefined, app.owner, removed.sources)).rejects.toBeInstanceOf(CompilerHmrResyncError)
    watcher.emit('add', app.file)
    const recovered = outputs(await buildStatefulHmrSnapshot(app.options, undefined, app.owner, app.host.freeze([]).sources))
    const recoveredAsset = recovered.find((item): item is OutputAsset => item.type === 'asset' && item.fileName.endsWith('.asset'))
    expect(recoveredAsset).toBeDefined()
    expect(Buffer.from(recoveredAsset!.source)).toEqual(Buffer.from([253]))
  }
  finally {
    tracker.dispose()
    await app.close()
  }
})

it('recovers a retargeted alias from the watcher while the previous frozen binding stays rejected', async () => {
  const app = await fixture('logo.svg', '<svg>FROZEN-ALIAS</svg>', '', true)
  const tracker = createCompilerDependencyTracker(app.owner)
  const watcher = new EventEmitter()
  try {
    tracker.remember(app.imported)
    tracker.configureServer({ watcher } as unknown as ViteDevServer)
    const input = app.host.freeze([])
    await writeFile(path.join(app.replacement, 'logo.svg'), '<svg>RECOVERED-ALIAS</svg>')
    await unlink(app.alias)
    await symlink(app.replacement, app.alias, 'junction')
    watcher.emit('change', app.imported)
    expect(app.host.ownsDependency(app.imported)).toBe(true)
    await expect(buildStatefulHmrSnapshot(app.options, undefined, app.owner, input.sources)).rejects.toBeInstanceOf(CompilerHmrResyncError)
    const recovered = outputs(await buildStatefulHmrSnapshot(app.options, undefined, app.owner, app.host.freeze([]).sources))
    const asset = recovered.find((item): item is OutputAsset => item.type === 'asset' && item.fileName.endsWith('.svg'))
    expect(asset).toBeDefined()
    expect(Buffer.from(asset!.source).toString()).toBe('<svg>RECOVERED-ALIAS</svg>')
    const scripts = recovered.flatMap(item => item.type === 'chunk' ? [item.code] : []).join('\n')
    expect(scripts).toContain(asset!.fileName)
    expect(scripts).toContain('PINNED-UTILITY')
    expect(scripts).not.toContain('FUTURE-UTILITY')
  }
  finally {
    tracker.dispose()
    await app.close()
  }
})

it('rejects an old physical input replaced by a junction after its observed alias moved elsewhere', async () => {
  const app = await fixture('logo.svg', '<svg>FROZEN-RETAINED</svg>', '', true)
  const tracker = createCompilerDependencyTracker(app.owner)
  const watcher = new EventEmitter()
  try {
    const retainedImport = 'import retained from "../assets-physical/logo.svg"; console.log("PINNED-UTILITY", retained)'
    app.host.captureNative(path.join(app.root, 'src/utility.ts'), retainedImport)
    tracker.remember(app.imported)
    tracker.configureServer({ watcher } as unknown as ViteDevServer)
    await writeFile(path.join(app.replacement, 'logo.svg'), '<svg>CURRENT-ALIAS</svg>')
    await unlink(app.alias)
    await symlink(app.replacement, app.alias, 'junction')
    watcher.emit('change', app.imported)
    const input = app.host.freeze([])
    const retainedReplacement = path.join(app.root, 'retained-replacement')
    await mkdir(retainedReplacement)
    await writeFile(path.join(retainedReplacement, 'logo.svg'), '<svg>FUTURE-RETAINED</svg>')
    await rm(app.physical, { recursive: true })
    await symlink(retainedReplacement, app.physical, 'junction')
    await expect(buildStatefulHmrSnapshot(app.options, undefined, app.owner, input.sources)).rejects.toBeInstanceOf(CompilerHmrResyncError)
  }
  finally {
    tracker.dispose()
    await app.close()
  }
})
