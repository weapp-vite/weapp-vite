import type { PluginContext } from 'rolldown'
import type { CompilerContext } from '../../../../context'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import logger from '../../../../logger'
import { compilerSourceId } from '../../../compilerPlugin/hmr'
import { UniAppCompatibilityTransformError } from '../../../uniApp'
import { setCompilerSourceSnapshot } from '../../../utils/sourceSnapshot'
import { createScriptSetupAnalyzer } from './scriptSetupAnalysis'
import { applyScriptSetupUsingComponents } from './template'

const resolveUsingComponentReference = vi.hoisted(() => vi.fn(async (_plugin: unknown, _config: unknown, _cache: unknown, source: string) => ({
  from: `/components/${source.includes('Active') ? 'active' : source.includes('Hidden') ? 'hidden' : source.includes('Alternate') ? 'alternate' : 'original'}`,
})))
vi.mock('../../../vue/transform/usingComponentResolver', () => ({ resolveUsingComponentReference }))
vi.mock('../../../../logger', () => ({ default: { warn: vi.fn() } }))

it.each(['../../../shared/pages/index/index.ts', '@shared/setup', 'shared-package/setup'])('resolves component imports from the selected external script source: %s', async (src) => {
  const temporaryRoot = await realpath(await mkdtemp(path.join(os.tmpdir(), 'script-setup-origin-')))
  try {
    const vueEntryPath = compilerSourceId(path.join(temporaryRoot, 'src/pages/index/index.vue'))
    const scriptId = compilerSourceId(path.join(temporaryRoot, 'shared/pages/index/index.ts'))
    const configService = { isDev: true, weappViteConfig: {} } as CompilerContext['configService']
    setCompilerSourceSnapshot(configService, new Map([[scriptId, 'import ReproLabel from "../../components/ReproLabel.vue";']]))
    await applyScriptSetupUsingComponents({
      pluginCtx: { resolve: vi.fn(async () => ({ id: scriptId })) } as unknown as PluginContext,
      vueEntryPath,
      source: `<script setup lang="ts" src="${src}"></script><template><ReproLabel /></template>`,
      templatePath: '',
      json: {},
      configService,
      reExportResolutionCache: new Map(),
    })
    expect(resolveUsingComponentReference).toHaveBeenLastCalledWith(
      expect.anything(),
      configService,
      expect.any(Map),
      '../../components/ReproLabel.vue',
      scriptId,
      expect.objectContaining({ localName: 'ReproLabel', fallbackRelativeImporterDir: true }),
    )
  }
  finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
})

it('reanalyzes resolved external blocks while preserving every src lookup and missing-source warning', async () => {
  const temporaryRoot = await realpath(await mkdtemp(path.join(os.tmpdir(), 'script-setup-src-')))
  try {
    const vueEntryPath = compilerSourceId(path.join(temporaryRoot, 'index.vue'))
    const templateId = compilerSourceId(path.join(temporaryRoot, 'template.html'))
    const scriptId = compilerSourceId(path.join(temporaryRoot, 'setup.ts'))
    const snapshots = new Map<string, string | null>([
      [templateId, '<DemoCard />'],
      [scriptId, 'import DemoCard from "./Original.vue"'],
    ])
    const source = '<template data-label="a > b" src="./template.html"></template><script setup src="./setup.ts"></script>'
    const configService = { isDev: true, weappViteConfig: {} } as CompilerContext['configService']
    setCompilerSourceSnapshot(configService, snapshots)
    const resolve = vi.fn(async (id: string) => ({ id: path.join(temporaryRoot, id) }))
    const scriptSetupAnalyzer = createScriptSetupAnalyzer()
    async function apply() {
      const json: { usingComponents?: Record<string, string> } = {}
      await applyScriptSetupUsingComponents({
        pluginCtx: { resolve } as unknown as PluginContext,
        vueEntryPath,
        source,
        templatePath: '',
        json,
        configService,
        scriptSetupAnalyzer,
        reExportResolutionCache: new Map(),
      })
      return json.usingComponents
    }

    const initial = await apply()
    expect(logger.warn).not.toHaveBeenCalled()
    expect(initial).toEqual({ DemoCard: '/components/original' })
    expect(await apply()).toEqual({ DemoCard: '/components/original' })
    snapshots.set(scriptId, 'import DemoCard from "./Alternate.vue"')
    expect(await apply()).toEqual({ DemoCard: '/components/alternate' })
    snapshots.set(templateId, '<demo-card />')
    expect(await apply()).toEqual({ 'demo-card': '/components/alternate' })
    snapshots.set(templateId, '<view>removed</view>')
    expect(await apply()).toBeUndefined()
    snapshots.set(templateId, '<DemoCard />')
    snapshots.set(scriptId, 'import DemoCard from "./Original.vue"')
    expect(await apply()).toEqual({ DemoCard: '/components/original' })
    expect(resolve.mock.calls.filter(([id]) => id === './template.html')).toHaveLength(6)
    expect(resolve.mock.calls.filter(([id]) => id === './setup.ts')).toHaveLength(6)
    expect(resolveUsingComponentReference).toHaveBeenCalledTimes(5)

    snapshots.set(templateId, null)
    expect(await apply()).toBeUndefined()
    expect(await apply()).toBeUndefined()
    expect(logger.warn).toHaveBeenCalledTimes(2)
    snapshots.set(templateId, '<DemoCard />')
    expect(await apply()).toEqual({ DemoCard: '/components/original' })
  }
  finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
})

it('prepares external template and script blocks by declaration without changing frozen raw inputs', async () => {
  const temporaryRoot = await realpath(await mkdtemp(path.join(os.tmpdir(), 'script-setup-uni-src-')))
  try {
    const vueEntryPath = compilerSourceId(path.join(temporaryRoot, 'index.vue'))
    const templateId = compilerSourceId(path.join(temporaryRoot, 'template.ts'))
    const scriptId = compilerSourceId(path.join(temporaryRoot, 'setup.html'))
    const template = (condition: string) => `<Active />\n<!-- #${condition} MP-WEIXIN -->\n<Hidden />\n<!-- #endif -->`
    const script = 'import Active from "./Active.vue"\nimport Hidden from "./Hidden.vue"'
    const snapshots = new Map<string, string | null>([[templateId, template('ifndef')], [scriptId, script]])
    const configService = {
      absoluteSrcRoot: temporaryRoot,
      platform: 'weapp',
      isDev: true,
      weappViteConfig: { uniApp: { include: [] } },
    } as CompilerContext['configService']
    setCompilerSourceSnapshot(configService, snapshots)
    const scriptSetupAnalyzer = createScriptSetupAnalyzer()
    const source = '<template src="./template.ts"></template><script setup src="./setup.html"></script>'
    const apply = async () => {
      const json: { usingComponents?: Record<string, string> } = {}
      await applyScriptSetupUsingComponents({
        pluginCtx: { resolve: async (id: string) => ({ id: path.join(temporaryRoot, id) }) } as unknown as PluginContext,
        vueEntryPath,
        source,
        templatePath: '',
        json,
        configService,
        scriptSetupAnalyzer,
        reExportResolutionCache: new Map(),
      })
      return json.usingComponents
    }
    expect(await apply()).toEqual({ Active: '/components/active' })
    expect(snapshots.get(templateId)).toBe(template('ifndef'))
    expect(snapshots.get(scriptId)).toBe(script)
    snapshots.set(templateId, template('ifdef'))
    expect(await apply()).toEqual({ Active: '/components/active', Hidden: '/components/hidden' })
    snapshots.set(templateId, template('ifndef'))
    expect(await apply()).toEqual({ Active: '/components/active' })
    snapshots.set(scriptId, 'const = 1')
    await expect(apply()).rejects.toBeInstanceOf(UniAppCompatibilityTransformError)
  }
  finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
})
