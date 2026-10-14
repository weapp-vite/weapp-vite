import type { OutputAsset, OutputChunk } from 'rolldown'
import type { InlineConfig } from 'vite'
import { Buffer } from 'node:buffer'
import { cp, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createCompilerContextInstance } from '../../context/createCompilerContextInstance'
import { CompilerHmrResyncError, compilerSourceId, getCompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import { readCompilerRawInput } from '../../plugins/compilerPlugin/rawInputs'
import { buildStatefulHmrSnapshot } from './snapshotBuild'

it.each(['loader-module', 'compiler-raw', 'compiler-alias', 'compiler-binary', 'unused-tombstone', 'unused-string'] as const)('preserves real asset emission and fixed script input with %s ownership', async (ownership) => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'snapshot-asset-ownership-')))
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10"/></svg>'
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 255])
  const custom = 'custom asset bytes'
  const files = {
    'package.json': JSON.stringify({ name: 'snapshot-asset-ownership', private: true, type: 'module' }),
    'project.config.json': JSON.stringify({ appid: 'wxb3d842a4a7e3440d', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
    'vite.config.ts': [
      `import { defineConfig } from ${JSON.stringify(path.resolve(import.meta.dirname, '../../config.ts'))}`,
      'export default defineConfig({ assetsInclude: ["**/*.asset"], build: { assetsInlineLimit: 0 }, weapp: { srcRoot: "src", autoRoutes: false, vue: { enable: false }, npm: { enable: false } } })',
    ].join('\n'),
    'src/app.ts': `import svg from ${JSON.stringify(ownership === 'compiler-alias' ? '../asset-alias/logo.svg' : './logo.svg')}; import png from "./logo.png"; import custom from "./design.asset"; import "./utility"; import "./empty"; App({ data: { urls: [svg, png, custom] } })`,
    'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
    'src/pages/index/index.ts': 'Page({})',
    'src/pages/index/index.json': '{}',
    'src/pages/index/index.wxml': '<view>asset ownership</view>',
    'src/logo.svg': svg,
    'src/logo.png': png,
    'src/design.asset': custom,
    'src/utility.ts': 'console.log("FUTURE-UTILITY")',
    'src/empty.ts': 'console.log("FUTURE-EMPTY")',
  }
  const owner = createCompilerContextInstance()
  try {
    for (const [relative, source] of Object.entries(files)) {
      const file = path.join(root, relative)
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(file, source)
    }
    await mkdir(path.join(root, 'node_modules'))
    await symlink(path.resolve(import.meta.dirname, '../../..'), path.join(root, 'node_modules/weapp-vite'), 'junction')
    const options = { cwd: root, isDev: true, mode: 'development' }
    await owner.configService.load(options)
    const host = getCompilerHmrHost(owner)
    const svgFile = path.join(root, 'src/logo.svg')
    if (ownership !== 'loader-module') {
      // 只验证稳定 alias 与物理 raw 身份一致，不把 alias 改指计为已冻结。
      if (ownership === 'compiler-alias') {
        await symlink(path.join(root, 'src'), path.join(root, 'asset-alias'), 'junction')
      }
      host.seed(ownership === 'compiler-alias' ? path.join(root, 'asset-alias/logo.svg') : svgFile, svg)
    }
    else {
      host.captureNative(svgFile, 'export default "SYNTHETIC-STALE-SVG-URL"')
    }
    if (ownership === 'compiler-binary') {
      const file = path.join(root, 'src/logo.png')
      const read = readCompilerRawInput(file)!
      host.seed(file, read.source, read)
    }
    else {
      host.captureNative(path.join(root, 'src/logo.png'), 'export default "SYNTHETIC-STALE-PNG-URL"')
    }
    host.seed(path.join(root, 'src/design.asset'), custom)
    if (ownership === 'unused-tombstone') {
      const unused = path.join(root, 'src/removed.asset')
      host.seed(unused, 'unreferenced asset')
      host.capture(unused, null)
    }
    const unused = path.join(root, 'src/unused.asset')
    if (ownership === 'unused-string') {
      await writeFile(unused, 'frozen unused asset')
      host.seed(unused, 'frozen unused asset')
    }
    host.captureNative(path.join(root, 'src/utility.ts'), 'console.log("PINNED-UTILITY")')
    host.captureNative(path.join(root, 'src/empty.ts'), '')
    const input = host.freeze([])
    if (ownership === 'unused-string') {
      await writeFile(unused, 'future unused asset')
    }
    expect(input.sources.get(compilerSourceId(path.join(root, 'src/empty.ts')))).toBe('')
    const result = await buildStatefulHmrSnapshot(options, undefined, owner, input.sources)
    const outputs: Array<OutputAsset | OutputChunk> = Array.isArray(result.output)
      ? result.output.flatMap(item => item.output)
      : 'output' in result.output ? result.output.output : []
    const scripts = outputs.flatMap(item => item.type === 'chunk' ? [item.code] : []).join('\n')
    for (const [extension, source] of [['.svg', svg], ['.png', png], ['.asset', custom]] as const) {
      const asset = outputs.find((item): item is OutputAsset => item.type === 'asset' && item.fileName.endsWith(extension))
      expect(asset).toBeDefined()
      expect(Buffer.from(asset!.source)).toEqual(Buffer.from(source))
      expect(scripts).toContain(asset!.fileName)
    }
    expect(scripts).toContain('PINNED-UTILITY')
    expect(scripts).not.toContain('FUTURE-UTILITY')
    expect(scripts).not.toContain('FUTURE-EMPTY')
    expect(scripts).not.toContain('SYNTHETIC-STALE')
  }
  finally {
    owner.moduleGraphService.resetSession()
    await rm(root, { recursive: true, force: true })
  }
})

it.each([
  ['logo.svg', 'before-build', '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10"/></svg>', '<svg xmlns="http://www.w3.org/2000/svg"><circle r="7"/></svg>'],
  ['design.asset', 'before-build', 'FROZEN-CUSTOM-ASSET', 'FUTURE-CUSTOM-ASSET'],
  ['logo.svg', 'during-build', '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10"/></svg>', '<svg xmlns="http://www.w3.org/2000/svg"><circle r="7"/></svg>'],
  ['design.asset', 'tombstone', 'FROZEN-CUSTOM-ASSET', 'FUTURE-CUSTOM-ASSET'],
  ['logo.svg', 'physical-retarget', '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10"/></svg>', '<svg xmlns="http://www.w3.org/2000/svg"><circle r="7"/></svg>'],
] as const)('rejects a changed raw %s asset or retains its frozen bytes before a watcher notification at %s', async (filename, stage, frozen, future) => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'snapshot-asset-version-')))
  const style = '.frozen-asset-style { width: 31px; }'
  const files = {
    'package.json': JSON.stringify({ name: 'snapshot-asset-version', private: true, type: 'module' }),
    'project.config.json': JSON.stringify({ appid: 'wxb3d842a4a7e3440d', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
    'vite.config.ts': [
      `import { defineConfig } from ${JSON.stringify(path.resolve(import.meta.dirname, '../../config.ts'))}`,
      'export default defineConfig({ assetsInclude: ["**/*.asset"], build: { assetsInlineLimit: 0, minify: false }, weapp: { srcRoot: "src", autoRoutes: false, vue: { enable: false }, npm: { enable: false } } })',
    ].join('\n'),
    'src/app.ts': `import asset from ${JSON.stringify(`./${filename}`)}; import "./utility"; App({ data: { asset } })`,
    'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
    'src/app.wxss': style,
    'src/pages/index/index.ts': 'Page({})',
    'src/pages/index/index.json': '{}',
    'src/pages/index/index.wxml': '<view class="frozen-asset-style">asset version</view>',
    [`src/${filename}`]: frozen,
    'src/utility.ts': 'console.log("FUTURE-UTILITY")',
  }
  const owner = createCompilerContextInstance()
  try {
    for (const [relative, source] of Object.entries(files)) {
      const file = path.join(root, relative)
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(file, source)
    }
    await mkdir(path.join(root, 'node_modules'))
    await symlink(path.resolve(import.meta.dirname, '../../..'), path.join(root, 'node_modules/weapp-vite'), 'junction')
    const options = { cwd: root, isDev: true, mode: 'development' }
    await owner.configService.load(options)
    const host = getCompilerHmrHost(owner)
    const assetFile = path.join(root, 'src', filename)
    host.seed(assetFile, frozen)
    host.captureRaw(path.join(root, 'src/app.wxss'), style)
    host.captureNative(path.join(root, 'src/utility.ts'), 'console.log("PINNED-UTILITY")')
    if (stage === 'tombstone') {
      host.capture(assetFile, null)
    }
    const input = host.freeze([])
    expect(input.sources.get(compilerSourceId(assetFile))).toBe(stage === 'tombstone' ? null : frozen)

    // 模拟 provider 等待期间磁盘已更新，但 watch owner 尚未通知 scheduler 的边界。
    // 不追加 capture 或 scheduler 事件，避免让取消代次替代资产版本准入。
    if (stage === 'before-build') {
      await writeFile(assetFile, future)
    }
    if (stage === 'physical-retarget') {
      const source = path.join(root, 'src')
      const replacement = path.join(root, 'replacement')
      await cp(source, replacement, { recursive: true })
      await writeFile(path.join(replacement, filename), future)
      await rm(source, { recursive: true })
      await symlink(replacement, source, 'junction')
    }
    const configure = stage === 'during-build'
      ? (config: InlineConfig) => ({
          ...config,
          plugins: [...(config.plugins ?? []), { name: 'asset-version-race', async buildEnd() { await writeFile(assetFile, future) } }],
        })
      : undefined
    const outcome = await buildStatefulHmrSnapshot(options, configure, owner, input.sources).then(
      output => ({ output }),
      (error: unknown) => ({ error }),
    )
    if ('error' in outcome) {
      expect(outcome.error).toBeInstanceOf(CompilerHmrResyncError)
      return
    }
    if (stage !== 'before-build') {
      expect.fail('A changed or removed raw input must be rejected before snapshot publication')
    }
    const result = outcome.output
    const outputs: Array<OutputAsset | OutputChunk> = Array.isArray(result.output)
      ? result.output.flatMap(item => item.output)
      : 'output' in result.output ? result.output.output : []
    const asset = outputs.find((item): item is OutputAsset => item.type === 'asset' && item.fileName.endsWith(path.extname(filename)))
    expect(asset).toBeDefined()
    expect(Buffer.from(asset!.source)).toEqual(Buffer.from(frozen))
    const styles = outputs.flatMap(item => item.type === 'asset' && item.fileName.endsWith('.wxss') ? [Buffer.from(item.source).toString()] : []).join('\n')
    expect(styles).toContain('31px')
    const scripts = outputs.flatMap(item => item.type === 'chunk' ? [item.code] : []).join('\n')
    expect(scripts).toContain(asset!.fileName)
    expect(scripts).toContain('PINNED-UTILITY')
    expect(scripts).not.toContain('FUTURE-UTILITY')
  }
  finally {
    owner.moduleGraphService.resetSession()
    await rm(root, { recursive: true, force: true })
  }
})
