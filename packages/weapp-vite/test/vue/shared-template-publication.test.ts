import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { createCompilerContextInstance } from '../../src/context/createCompilerContextInstance'
import { refreshSnapshotSources } from '../../src/runtime/buildPlugin/snapshotSources'
import { createSharedBuildConfig } from '../../src/runtime/sharedBuildConfig'

interface PageJson {
  component?: boolean
  usingComponents?: Record<string, string>
}

it.each(['inline', 'external'] as const)('keeps %s shared-template page JSON complete across edits and component removal', async (mode) => {
  const project = await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-shared-template-publication-')))
  const repo = path.resolve(import.meta.dirname, '../../../..')
  const sourcePath = (file: string) => path.join(project, 'src', file).replaceAll('\\', '/')
  const sfc = sourcePath('pages/sfc/index.vue')
  const page = sfc
  const shared = sourcePath('shared/card.wxml')
  const templateSource = (marker: string, withProbe: boolean) => [
    '<template name="sharedCard">',
    `  <view>${marker}</view>`,
    withProbe ? `  <shared-probe marker="${marker}" />` : '',
    '</template>',
  ].join('\n')
  // 自定义标签只存在于被 import 的原生模板，页面显式配置必须始终独立保留。
  const inlineHost = [
    '<script setup lang="ts">',
    'import { setPageLayout } from \'wevu\'',
    'function selectAdmin() { setPageLayout(\'admin\') }',
    '</script>',
    '<template>',
    '  <import src="../../shared/card.wxml" />',
    '  <view><template is="sharedCard" /><button @tap="selectAdmin">layout</button></view>',
    '</template>',
    '<json>',
    JSON.stringify({ component: false, usingComponents: { 'manual-probe': '/components/manual-probe/index' } }),
    '</json>',
  ].join('\n')
  const externalTemplate = sourcePath('pages/sfc/parts/body.wxml')
  const externalContent = [
    '<import src="../../../shared/card.wxml" />',
    '<include src="./included.wxml" />',
    '<wxs module="helper" src="./filter.wxs" />',
    '<view :class="[\'template-content\', { active: true }]" :style="[{ color: \'red\' }]"><template is="sharedCard" /><button @tap="selectAdmin">layout</button></view>',
  ].join('\n')
  const host = mode === 'external'
    ? inlineHost.replace(/<template>[\s\S]*?<\/template>/, '<template src="./parts/body.wxml"></template>')
    : inlineHost
  const config = {
    weapp: {
      srcRoot: 'src',
      autoRoutes: false,
      vue: { template: { classStyleRuntime: 'wxs' } },
      hmr: { runtime: 'classic' },
      npm: { enable: false },
      autoImportComponents: {
        globs: ['components/**/*.wxml'],
        output: false,
        typedComponents: false,
        htmlCustomData: false,
        vueComponents: false,
      },
    },
  }
  const files: Record<string, string> = {
    'package.json': JSON.stringify({ name: 'shared-template-publication', private: true, dependencies: { wevu: '*' } }),
    'project.config.json': JSON.stringify({ appid: 'wxb3d842a4a7e3440d', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
    'vite.config.ts': `import { defineConfig } from ${JSON.stringify(path.join(repo, 'packages/weapp-vite/src/config.ts'))}; export default defineConfig(${JSON.stringify(config)})`,
    'src/app.ts': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/native/index', 'pages/sfc/index'] }),
    'src/pages/native/index.ts': 'Page({})',
    'src/pages/native/index.json': '{}',
    'src/pages/native/index.wxml': '<import src="../../shared/card.wxml"/><template is="sharedCard"/>',
    'src/pages/sfc/index.vue': host,
    'src/shared/card.wxml': templateSource('initial', true),
    'src/components/shared-probe/index.ts': 'Component({ properties: { marker: String } })',
    'src/components/shared-probe/index.json': '{"component":true}',
    'src/components/shared-probe/index.wxml': '<view>{{marker}}</view>',
    'src/components/manual-probe/index.ts': 'Component({})',
    'src/components/manual-probe/index.json': '{"component":true}',
    'src/components/manual-probe/index.wxml': '<view>manual</view>',
    'src/layouts/default/index.vue': '<template><view><slot /></view></template>',
    'src/layouts/admin/index.vue': '<template><view><slot /></view></template>',
  }
  const ctx = createCompilerContextInstance()
  try {
    if (mode === 'external') {
      files['src/pages/sfc/parts/body.wxml'] = externalContent
      files['src/pages/sfc/parts/included.wxml'] = '<view>included</view>'
      files['src/pages/sfc/parts/filter.wxs'] = 'module.exports = {}'
    }
    for (const [name, content] of Object.entries(files)) {
      const file = path.join(project, name)
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(file, content)
    }
    await mkdir(path.join(project, 'node_modules'))
    await symlink(path.join(repo, 'packages-runtime/wevu'), path.join(project, 'node_modules/wevu'), 'junction')
    await symlink(path.join(repo, 'packages/weapp-vite'), path.join(project, 'node_modules/weapp-vite'), 'junction')
    ctx.currentBuildTarget = 'app'
    await ctx.configService.load({ cwd: project, isDev: true, mode: 'development' })
    expect(ctx.configService.weappViteConfig.vue?.template?.classStyleRuntime).toBe('wxs')
    await ctx.scanService.loadAppEntry()
    ctx.scanService.loadSubPackages()
    const options = ctx.configService.merge(undefined, createSharedBuildConfig(ctx.configService, ctx.scanService))
    options.build = { ...options.build, watch: undefined, write: true, emptyOutDir: false }
    const readOutput = (file: string) => readFile(path.join(project, 'dist', file), 'utf8')
    const expectedBindings = (withProbe: boolean) => ({
      'manual-probe': '/components/manual-probe/index',
      'weapp-layout-admin': '/layouts/admin/index',
      'weapp-layout-default': '/layouts/default/index',
      ...(withProbe ? { 'shared-probe': '/components/shared-probe/index' } : {}),
    })
    async function verify(phase: string, marker: string, withProbe: boolean) {
      const source = await readOutput('pages/sfc/index.json')
      const json = JSON.parse(source) as PageJson
      // 使用软断言保留同一真实构建会话的后续阶段证据，不把错误冷基线当作正确结果。
      expect.soft(json, `${phase}: complete page config`).toEqual({ component: false, usingComponents: expectedBindings(withProbe) })
      const sharedOutput = await readOutput('shared/card.wxml')
      expect.soft(sharedOutput, `${phase}: template marker`).toContain(marker)
      expect.soft(sharedOutput.includes('<shared-probe'), `${phase}: template component`).toBe(withProbe)
      expect(await readFile(sfc, 'utf8')).toBe(host)
      return source
    }

    await build(options)
    const appJson = JSON.parse(await readOutput('app.json')) as { pages: string[] }
    expect.soft(appJson.pages, 'host app routes').toEqual(['pages/native/index', 'pages/sfc/index'])
    expect.soft(ctx.moduleGraphService.collectAffectedEntries(shared), 'cold: imported template owner').toContain(page)
    expect.soft(ctx.wxmlService.getImporters(shared), 'cold: WXML importer').toContain(sfc)
    if (mode === 'external') {
      for (const dependency of [externalTemplate, sourcePath('pages/sfc/parts/included.wxml'), sourcePath('pages/sfc/parts/filter.wxs')]) {
        expect.soft(ctx.moduleGraphService.collectAffectedEntries(dependency), 'cold: external template dependency').toContain(page)
      }
      expect.soft(await readOutput('pages/sfc/index.wxml'), 'external dependency output base').toContain('./parts/included.wxml')
      const emittedTemplate = await readOutput('pages/sfc/index.wxml')
      const { deps } = ctx.wxmlService.analyze(emittedTemplate)
      const nativeWxs = deps.find(dependency => dependency.attrs.module === 'helper')
      const generatedWxs = deps.find(dependency => dependency.tagName === 'wxs' && dependency.attrs.module !== 'helper')
      expect(nativeWxs?.value).toBe('./parts/filter.wxs')
      expect(generatedWxs, emittedTemplate).toBeDefined()
      for (const dependency of [nativeWxs, generatedWxs]) {
        expect(await readOutput(path.posix.join('pages/sfc', dependency!.value))).not.toBe('')
      }
    }
    const cold = await verify('cold', 'initial', true)
    for (const entry of ['pages/native/index', 'pages/sfc/index', 'components/shared-probe/index', 'components/manual-probe/index', 'layouts/default/index', 'layouts/admin/index']) {
      for (const extension of ['js', 'json', 'wxml']) {
        expect(await readOutput(`${entry}.${extension}`), `${entry}.${extension}`).not.toBe('')
      }
    }

    for (const step of [{ marker: 'edited', withProbe: true }, { marker: 'removed', withProbe: false }, { marker: 'restored', withProbe: true }]) {
      await writeFile(shared, templateSource(step.marker, step.withProbe))
      // 与 snapshot scheduler 一样，先查询上一代图，再刷新本批真实输入；不补造 SFC owner。
      const affected = ctx.moduleGraphService.collectAffectedEntries(shared)
      expect.soft(affected, `${step.marker}: imported template owner`).toContain(page)
      ctx.moduleGraphService.recordChangedFile(shared, 'update')
      await refreshSnapshotSources(ctx, [{ file: shared, event: 'update' }], ctx.autoRoutesService.getSignature())
      const hmr = ctx.runtimeState.build.hmr
      for (const owner of affected) {
        hmr.dirtyEntrySet.add(owner)
        hmr.dirtyEntryReasons.set(owner, 'metadata')
        hmr.loadedEntrySet.delete(owner)
      }
      hmr.profile = { event: 'update', file: shared, dirtyReasonSummary: ['sidecar-direct:1'] }
      await build(options)
      const updated = await verify(step.marker, step.marker, step.withProbe)
      if (step.marker === 'edited') {
        expect.soft(updated, 'marker edit: final JSON bytes').toBe(cold)
      }
    }

    // SFC 和外部块移除 import 后，真实逻辑入口图不能继承上一代 shared 边。
    const templateOwner = mode === 'external' ? externalTemplate : sfc
    const removedSource = mode === 'external'
      ? '<view>no native template dependencies</view>'
      : host.replace('<import src="../../shared/card.wxml" />', '')
    await writeFile(templateOwner, removedSource)
    const affected = ctx.moduleGraphService.collectAffectedEntries(templateOwner)
    expect.soft(affected, 'removed import: template owner').toContain(page)
    ctx.moduleGraphService.recordChangedFile(templateOwner, 'update')
    await refreshSnapshotSources(ctx, [{ file: templateOwner, event: 'update' }], ctx.autoRoutesService.getSignature())
    const hmr = ctx.runtimeState.build.hmr
    for (const owner of affected) {
      hmr.dirtyEntrySet.add(owner)
      hmr.dirtyEntryReasons.set(owner, 'metadata')
      hmr.loadedEntrySet.delete(owner)
    }
    hmr.profile = { event: 'update', file: templateOwner, dirtyReasonSummary: ['sidecar-direct:1'] }
    await build(options)
    const finalJson = JSON.parse(await readOutput('pages/sfc/index.json')) as PageJson
    expect.soft(finalJson, 'removed import: current page config').toEqual({ component: false, usingComponents: expectedBindings(false) })
    expect.soft(await readOutput('pages/sfc/index.wxml'), 'removed import: current template').not.toContain('shared/card.wxml')
    expect.soft(ctx.moduleGraphService.collectAffectedEntries(shared), 'removed import: stale shared edge').not.toContain(page)
    if (mode === 'external') {
      for (const dependency of [sourcePath('pages/sfc/parts/included.wxml'), sourcePath('pages/sfc/parts/filter.wxs')]) {
        expect.soft(ctx.moduleGraphService.collectAffectedEntries(dependency), 'removed import: stale external edge').not.toContain(page)
      }
    }
  }
  finally {
    await ctx.watcherService.closeAll()
    ctx.moduleGraphService.resetSession()
    await rm(project, { recursive: true, force: true })
  }
})
