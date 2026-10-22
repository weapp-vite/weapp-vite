import type { Plugin } from 'vite'
import type { NativeOutputPublicationApi, NativeOutputPublicationSnapshot } from '../outputFinalizer/publicationObservation'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { WEAPP_VITE_OUTPUT_PUBLICATION_PLUGIN_NAME } from '@weapp-core/constants'
import { expect, it, onTestFailed, vi } from 'vitest'
import * as vueStyleSnapshot from '../../runtime/buildPlugin/vueStyleSnapshot'
import { CompilerSession } from '../../runtime/compilerSession'
import { getHmrStyleUpdatePlan } from '../../runtime/hmrStyleUpdate'

interface PublicationReceipt {
  snapshotCall: number
  snapshot?: NativeOutputPublicationSnapshot
  phase: string
  files: string[]
  plan?: { full: boolean, styles: string[], importers: string[], compiler: string[] }
}

it('preserves untouched native component CSS and its import closure across consecutive classic edits', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-warm-native-sidecars-')))
  const outDir = path.join(root, 'dist')
  const changedStyle = 'components/a/index.wxss'
  const untouchedStyle = 'components/b/index.wxss'
  const source = (color: string) => `.changing-a { color: ${color}; }\n`
  const importedSource = '@import "../../style/theme.wxss";\n.stable-b { padding: 13px; }\n'
  const independentSource = '.stable-b { padding: 13px; }\n'
  const themeSource = (color: string) => `.shared-theme { color: ${color}; }\n`
  const initialColor = '#123456'
  const session = new CompilerSession()
  const receipts: PublicationReceipt[] = []
  const observations: Promise<void>[] = []
  const errors: unknown[] = []
  const originalSnapshot = vueStyleSnapshot.withVueStyleDependencySnapshot
  const snapshotBuilds = vi.spyOn(vueStyleSnapshot, 'withVueStyleDependencySnapshot')
    .mockImplementation((...args) => originalSnapshot(...args))
  let drainedSnapshots = 0
  let initialized = false
  let phase = 'initial'
  const label = (file: string) => path.relative(root, file).replaceAll('\\', '/')
  const pending = new WeakMap<object, { api: NativeOutputPublicationApi, epoch: number }>()
  const observer: Plugin = {
    name: 'warm-native-sidecar-publication-observer',
    generateBundle: {
      order: 'post',
      sequential: true,
      handler() {
        const api = this.environment.config.plugins.find(plugin => plugin.name === WEAPP_VITE_OUTPUT_PUBLICATION_PLUGIN_NAME)?.api as NativeOutputPublicationApi | undefined
        if (!api) {
          throw new Error('Classic build has no native publication observer')
        }
        pending.set(this.environment, { api, epoch: api.getEpoch() })
      },
    },
    writeBundle: {
      order: 'post',
      sequential: true,
      handler(_options, bundle) {
        const publication = pending.get(this.environment)
        if (!publication) {
          throw new Error('Native write has no matching generation')
        }
        pending.delete(this.environment)
        const plan = getHmrStyleUpdatePlan(session.context.configService)
        const receipt: PublicationReceipt = {
          snapshotCall: snapshotBuilds.mock.calls.length,
          phase,
          files: Object.keys(bundle),
          plan: plan ? { full: plan.full, styles: [...plan.styleFiles].map(label), importers: [...plan.cssImporterOwners].map(label), compiler: [...plan.compilerContentOwners.keys()].map(label) } : undefined,
        }
        receipts.push(receipt)
        // 不能在写出钩子内等待后置发布提交；只观察原生写出结果。
        observations.push(publication.api.whenCommitted(outDir, publication.epoch).then((snapshot) => {
          receipt.snapshot = snapshot
        }).catch((error: unknown) => { errors.push(error) }))
      },
    },
  }
  const waitForPublication = async (cursor: number, color: string, accept?: (snapshot: NativeOutputPublicationSnapshot) => boolean) => {
    const find = () => receipts.slice(cursor).find(receipt => receipt.snapshot
      && String(receipt.snapshot.outputs.get(changedStyle)).includes(color)
      && (!accept || accept(receipt.snapshot)))
    await expect.poll(() => Boolean(find()), { timeout: 15_000 }).toBe(true)
    const receipt = find()!
    if (cursor > 0) {
      expect(receipt.snapshotCall).toBeGreaterThan(drainedSnapshots)
      expect(snapshotBuilds.mock.calls[receipt.snapshotCall - 1]?.[0].configService).toBe(session.context.configService)
    }
    // 发布提交早于源码漂移检查；等实际快照调用完成后再进行下一次保存。
    while (drainedSnapshots < snapshotBuilds.mock.results.length) {
      const result = snapshotBuilds.mock.results[drainedSnapshots++]!
      if (result.type !== 'return') {
        throw new Error('Snapshot observation did not return its completion', { cause: result.value })
      }
      await result.value
    }
    expect(errors).toEqual([])
    const snapshot = receipt.snapshot!
    expect(await readFile(path.join(outDir, changedStyle), 'utf8')).toBe(snapshot.outputs.get(changedStyle))
    return snapshot
  }
  const expectStylesheetClosure = async (snapshot: NativeOutputPublicationSnapshot) => {
    for (const [file, content] of snapshot.outputs) {
      if (!file.endsWith('.wxss')) {
        continue
      }
      expect(content).toBeTypeOf('string')
      expect(await readFile(path.join(outDir, file), 'utf8')).toBe(content)
      for (const match of String(content).matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']/g)) {
        const imported = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]!))
        expect(snapshot.outputs.has(imported), `${file} imports missing ${imported}`).toBe(true)
        expect((await readFile(path.join(outDir, imported))).length).toBeGreaterThan(0)
      }
    }
  }
  onTestFailed(() => {
    process.stderr.write(`[warm-native-sidecars] ${JSON.stringify({
      errors: errors.map(String),
      receipts: receipts.slice(-3).map(receipt => ({
        ...receipt,
        snapshot: receipt.snapshot ? Object.fromEntries(['app.wxss', changedStyle, untouchedStyle].map(file => [file, String(receipt.snapshot!.outputs.get(file)).slice(0, 350)])) : undefined,
      })),
    })}\n`)
  })
  try {
    const files = {
      'package.json': JSON.stringify({ name: 'warm-native-sidecars', private: true, type: 'module' }),
      'project.config.json': JSON.stringify({ appid: 'wxb3d842a4a7e3440d', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
      'src/app.js': 'App({})',
      'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
      'src/app.wxss': '@import "./style/theme.wxss";\n.app { display: block; }\n',
      'src/pages/index/index.js': 'Page({})',
      'src/pages/index/index.json': JSON.stringify({ usingComponents: { 'component-a': '../../components/a/index', 'component-b': '../../components/b/index' } }),
      'src/pages/index/index.wxml': '<view class="app"><component-a /><component-b /></view>',
      'src/components/a/index.js': 'Component({})',
      'src/components/a/index.json': JSON.stringify({ component: true }),
      'src/components/a/index.wxml': '<view class="changing-a">A</view>',
      'src/components/a/index.wxss': source(initialColor),
      'src/components/b/index.js': 'Component({})',
      'src/components/b/index.json': JSON.stringify({ component: true }),
      'src/components/b/index.wxml': '<view class="shared-theme stable-b">B</view>',
      'src/components/b/index.wxss': importedSource,
      'src/style/theme.wxss': themeSource('#13579b'),
    }
    for (const [file, content] of Object.entries(files)) {
      const target = path.join(root, file)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, content)
    }
    const ctx = await session.initialize({
      cwd: root,
      isDev: true,
      mode: 'development',
      inlineConfig: {
        configFile: false,
        logLevel: 'silent',
        plugins: [observer],
        weapp: { srcRoot: 'src', autoRoutes: false, hmr: { runtime: 'classic' } },
        build: { minify: false, cssMinify: false },
      },
    })
    initialized = true
    session.onClose(() => ctx.watcherService.closeAll())
    const watcher = await session.run(() => ctx.buildService.build({ skipNpm: true }))
    if (Array.isArray(watcher) || !('on' in watcher)) {
      throw new Error('Classic development build did not return its watcher')
    }
    watcher.on('event', (event) => {
      if (event.code === 'ERROR') {
        errors.push(event.error)
      }
    })
    const initial = await waitForPublication(0, initialColor)
    const baseline = initial.outputs.get(untouchedStyle)
    const scripts = [...initial.outputs].filter(([file]) => file.endsWith('.js') && file !== 'app.js')
    const expectScriptsStable = async (snapshot: NativeOutputPublicationSnapshot) => {
      for (const [file, content] of scripts) {
        expect(snapshot.outputs.get(file)).toBe(content)
        expect(await readFile(path.join(outDir, file), 'utf8')).toBe(content)
      }
      const receipt = receipts.find(item => item.snapshot === snapshot)
      expect(receipt?.files.filter(file => file.endsWith('.js') && file !== 'app.js')).toEqual([])
    }
    expect(baseline).toBeTypeOf('string')
    expect(baseline).toContain('stable-b')
    expect(baseline).toContain('#13579b')
    expect(baseline).toMatch(/padding:\s*13px/)
    await expectStylesheetClosure(initial)
    for (const color of ['#abcdef', initialColor, '#fedcba']) {
      const cursor = receipts.length
      phase = `component-a:${color}`
      await writeFile(path.join(root, 'src', changedStyle), source(color))
      const updated = await waitForPublication(cursor, color)
      // B 没有变化，不能被原始 sidecar 覆盖而恢复已经编译内联的 @import。
      expect(updated.outputs.get(untouchedStyle)).toBe(baseline)
      expect(await readFile(path.join(outDir, untouchedStyle), 'utf8')).toBe(baseline)
      await expectScriptsStable(updated)
      await expectStylesheetClosure(updated)
    }

    const theme = path.join(root, 'src/style/theme.wxss')
    const lastColor = '#fedcba'
    const themeCursor = receipts.length
    phase = 'theme-update'
    await writeFile(theme, themeSource('#2468ac'))
    const themed = await waitForPublication(themeCursor, lastColor, snapshot => String(snapshot.outputs.get(untouchedStyle)).includes('#2468ac'))
    expect(themed.outputs.get(untouchedStyle)).not.toContain('#13579b')
    expect(themed.outputs.get('app.wxss')).toContain('#2468ac')
    await expectScriptsStable(themed)
    await expectStylesheetClosure(themed)

    // 移除真实导入后撤销旧依赖；之后主题变化不能把已退休的内容重新注入 B。
    const removeCursor = receipts.length
    phase = 'remove-component-b-import'
    await writeFile(path.join(root, 'src', untouchedStyle), independentSource)
    const removed = await waitForPublication(removeCursor, lastColor, snapshot => !String(snapshot.outputs.get(untouchedStyle)).includes('shared-theme'))
    const independent = removed.outputs.get(untouchedStyle)
    expect(independent).toMatch(/padding:\s*13px/)
    await expectScriptsStable(removed)
    await expectStylesheetClosure(removed)
    const nextThemeCursor = receipts.length
    phase = 'theme-update-without-component-b'
    await writeFile(theme, themeSource('#97531b'))
    const nextTheme = await waitForPublication(nextThemeCursor, lastColor, snapshot => String(snapshot.outputs.get('app.wxss')).includes('#97531b'))
    expect(nextTheme.outputs.get(untouchedStyle)).toBe(independent)
    await expectScriptsStable(nextTheme)
    await expectStylesheetClosure(nextTheme)

    const restoreCursor = receipts.length
    phase = 'restore-component-b-import'
    await writeFile(path.join(root, 'src', untouchedStyle), importedSource)
    const restored = await waitForPublication(restoreCursor, lastColor, snapshot => String(snapshot.outputs.get(untouchedStyle)).includes('#97531b'))
    const restoredStyles = restored.outputs.get(untouchedStyle)
    expect(restoredStyles).not.toContain('#2468ac')
    await expectScriptsStable(restored)
    await expectStylesheetClosure(restored)
    const finalCursor = receipts.length
    phase = 'component-a-after-theme-update'
    await writeFile(path.join(root, 'src', changedStyle), source(initialColor))
    const final = await waitForPublication(finalCursor, initialColor)
    expect(final.outputs.get(untouchedStyle)).toBe(restoredStyles)
    await expectScriptsStable(final)
    await expectStylesheetClosure(final)

    // 真正撤销组件引用并删除源文件后，由 watcher 的完整入口扫描退休所有原生产物。
    const deleteCursor = receipts.length
    phase = 'delete-component-b-owner'
    await writeFile(path.join(root, 'src/pages/index/index.json'), JSON.stringify({ usingComponents: { 'component-a': '../../components/a/index' } }))
    await rm(path.join(root, 'src/components/b'), { recursive: true })
    const retiredFiles = [...initial.outputs.keys()].filter(file => file.startsWith('components/b/'))
    expect(retiredFiles).toEqual(expect.arrayContaining(['components/b/index.js', 'components/b/index.json', 'components/b/index.wxml', untouchedStyle]))
    const deleted = await waitForPublication(deleteCursor, initialColor, snapshot => retiredFiles.every(file => !snapshot.outputs.has(file)))
    for (const file of retiredFiles) {
      await expect(readFile(path.join(outDir, file))).rejects.toMatchObject({ code: 'ENOENT' })
    }
    expect(deleted.outputs.get(changedStyle)).toBe(final.outputs.get(changedStyle))
    expect(deleted.outputs.get('components/a/index.js')).toBe(final.outputs.get('components/a/index.js'))
    expect(await readFile(path.join(outDir, 'components/a/index.js'), 'utf8')).toBe(final.outputs.get('components/a/index.js'))
    expect(session.context.runtimeState.build.hmr.resolvedEntryMap.has(path.join(root, 'src/components/b/index.js'))).toBe(false)
    expect(session.context.moduleGraphService.collectAffectedEntries(theme)).not.toContain(path.join(root, 'src/components/b/index.js'))
    expect(session.context.runtimeState.css.sidecarImports.has(path.join(root, 'src/components/b/index.wxss'))).toBe(false)
    await expectStylesheetClosure(deleted)
    expect(errors).toEqual([])
  }
  finally {
    try {
      await session.close()
      await session.close()
      await Promise.all(observations)
      if (initialized) {
        expect(session.context.watcherService.rollupWatcherMap.size).toBe(0)
        expect(session.context.watcherService.sidecarWatcherMap.size).toBe(0)
        expect(session.context.runtimeState.build.independent.watchListeners.size).toBe(0)
      }
      expect(errors).toEqual([])
    }
    finally {
      snapshotBuilds.mockRestore()
      await rm(root, { recursive: true, force: true })
    }
  }
}, 60_000)
