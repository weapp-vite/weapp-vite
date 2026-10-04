import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { createCompilerContextInstance } from '../../src/context/createCompilerContextInstance'
import { invalidateFileCache } from '../../src/plugins/utils/cache'
import { withVueStyleDependencySnapshot } from '../../src/runtime/buildPlugin/vueStyleSnapshot'
import { createSharedBuildConfig } from '../../src/runtime/sharedBuildConfig'

it('publishes external template component restoration after separate script removal and restoration', async () => {
  const project = await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-external-template-')))
  const repo = path.resolve(import.meta.dirname, '../../../..')
  const entry = path.join(project, 'src/pages/index/index.vue').replaceAll('\\', '/')
  const template = path.join(project, 'src/pages/index/template.html').replaceAll('\\', '/')
  const script = path.join(project, 'src/pages/index/setup.ts').replaceAll('\\', '/')
  const host = '<template src="./template.html"></template>\n<script setup lang="ts" src="./setup.ts"></script>\n'
  const templateSource = (marker: string, enabled: boolean) => `<view id="external-page"><view id="external-marker">${marker}</view>${enabled ? '<local-card id="external-card" />' : ''}</view>`
  const scriptSource = (component: string | null) => component ? `import LocalCard from '../../components/${component}/index.vue'\n` : ''
  const files: Record<string, string> = {
    'package.json': JSON.stringify({ name: 'external-template-publication', private: true, dependencies: { wevu: '*' } }),
    'project.config.json': JSON.stringify({ appid: 'wx1234567890abcd', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
    'vite.config.ts': `import { defineConfig } from ${JSON.stringify(path.join(repo, 'packages/weapp-vite/src/config.ts'))}; export default defineConfig({ weapp: { srcRoot: "src", hmr: { runtime: "classic" } } })`,
    'src/app.ts': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
    'src/pages/index/index.vue': host,
    'src/pages/index/template.html': templateSource('initial', true),
    'src/pages/index/setup.ts': scriptSource('AutoCard'),
    'src/components/AutoCard/index.vue': '<template><view>auto-card</view></template>',
    'src/components/AlternateCard/index.vue': '<template><view>alternate-card</view></template>',
  }
  const ctx = createCompilerContextInstance()
  try {
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
    await ctx.scanService.loadAppEntry()
    ctx.scanService.loadSubPackages()
    const options = ctx.configService.merge(undefined, createSharedBuildConfig(ctx.configService, ctx.scanService))
    options.build = { ...options.build, watch: undefined, write: true, emptyOutDir: false }
    const resolver = { resolve: async (id: string, importer: string) => ({ id: path.resolve(path.dirname(importer), id) }) }
    const readOutput = (file: string) => readFile(path.join(project, 'dist', file), 'utf8')
    async function verify(marker: string, component: string | null) {
      const config = JSON.parse(await readOutput('pages/index/index.json')) as { usingComponents?: Record<string, string> }
      expect(config.usingComponents?.['local-card']).toBe(component ? `/components/${component}/index` : undefined)
      const wxml = await readOutput('pages/index/index.wxml')
      expect(wxml).toContain(marker)
      expect(wxml.includes('<local-card')).toBe(component !== null)
      for (const extension of ['js', 'json', 'wxml']) {
        expect(await readOutput(`pages/index/index.${extension}`)).not.toBe('')
        if (component) {
          expect(await readOutput(`components/${component}/index.${extension}`)).not.toBe('')
        }
      }
      expect(await readFile(entry, 'utf8')).toBe(host)
    }
    await build(options)
    await verify('initial', 'AutoCard')
    const steps = [
      { file: template, source: templateSource('edited', true), marker: 'edited', component: 'AutoCard' },
      { file: script, source: scriptSource('AlternateCard'), marker: 'edited', component: 'AlternateCard' },
      { file: template, source: templateSource('removed', false), marker: 'removed', component: null },
      { file: script, source: scriptSource(null), marker: 'removed', component: null },
      { file: script, source: scriptSource('AutoCard'), marker: 'removed', component: null },
      { file: template, source: templateSource('restored', true), marker: 'restored', component: 'AutoCard' },
    ]
    for (const step of steps) {
      await writeFile(step.file, step.source)
      invalidateFileCache(step.file)
      ctx.moduleGraphService.recordChangedFile(step.file, 'update')
      ctx.moduleGraphService.bindPluginContext(resolver, resolver)
      await withVueStyleDependencySnapshot(ctx, [entry], [step.file], async () => {
        const hmr = ctx.runtimeState.build.hmr
        hmr.dirtyEntrySet.add(entry)
        hmr.dirtyEntryReasons.set(entry, step.file === template ? 'metadata' : 'direct')
        hmr.loadedEntrySet.delete(entry)
        hmr.dirtyVueEntryIds.add(entry)
        hmr.profile = { event: 'update', file: step.file, dirtyReasonSummary: [step.file === template ? 'sidecar:1' : 'importer:1'] }
        await build(options)
      }, () => {
        throw new Error('Sequential fixture inputs must not drift during publication')
      })
      await verify(step.marker, step.component)
    }
  }
  finally {
    ctx.moduleGraphService.resetSession()
    await rm(project, { recursive: true, force: true })
  }
})
