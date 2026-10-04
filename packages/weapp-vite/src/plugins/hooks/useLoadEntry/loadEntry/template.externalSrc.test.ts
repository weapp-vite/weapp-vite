import type { PluginContext } from 'rolldown'
import type { CompilerContext } from '../../../../context'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import logger from '../../../../logger'
import { compilerSourceId } from '../../../compilerPlugin/hmr'
import { setCompilerSourceSnapshot } from '../../../utils/sourceSnapshot'
import { createScriptSetupAnalyzer } from './scriptSetupAnalysis'
import { applyScriptSetupUsingComponents } from './template'

const resolveUsingComponentReference = vi.hoisted(() => vi.fn(async (_plugin: unknown, _config: unknown, _cache: unknown, source: string) => ({
  from: `/components/${source.includes('Alternate') ? 'alternate' : 'original'}`,
})))
vi.mock('../../../vue/transform/usingComponentResolver', () => ({ resolveUsingComponentReference }))
vi.mock('../../../../logger', () => ({ default: { warn: vi.fn() } }))

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
