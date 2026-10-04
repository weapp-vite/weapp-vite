import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const installerUrl = new URL('./index.ts', import.meta.url).href
const bindingUrl = new URL('../../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/bindingManifest.ts', import.meta.url).href
const templateUrl = new URL('../../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template.ts', import.meta.url).href
const cwd = fileURLToPath(new URL('../../../', import.meta.url))

function runIsolated(source: string): unknown {
  const stdout = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', source], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return JSON.parse(stdout)
}

describe('compile batch loader control', () => {
  it('loads original compiler logic through strip without collector export, queue globals or analysis counts', () => {
    const result = runIsolated(`
      const { installCompileBatch } = await import(${JSON.stringify(installerUrl)});
      const batch = await installCompileBatch({ mode: 'control-js' });
      try {
        const binding = await import(${JSON.stringify(bindingUrl)});
        const { compileVueTemplateToWxml } = await import(${JSON.stringify(templateUrl)});
        const compiled = compileVueTemplateToWxml('<view>{{ value }}</view>', 'fixture.vue');
        batch.assertDrained();
        console.log(JSON.stringify({
          hasCollector: 'experimentalCompileBatchCollectDependencies' in binding,
          hasGlobal: Object.hasOwn(globalThis, '__weappViteExperimentalCompileBindingBatch'),
          diagnostics: compiled.diagnostics,
          bindingCount: compiled.bindingManifest.bindings.length,
          stats: batch.snapshot(),
          sourceCount: Object.keys(batch.sourceHashes).length,
        }));
      } finally { batch.dispose(); }
    `) as { hasCollector: boolean, hasGlobal: boolean, diagnostics: unknown[], bindingCount: number, stats: Record<string, unknown>, sourceCount: number }
    expect(result).toMatchObject({ hasCollector: false, hasGlobal: false, diagnostics: [], sourceCount: 3 })
    expect(result.bindingCount).toBeGreaterThan(0)
    expect(Object.entries(result.stats).filter(([key]) => key !== 'fallbackReasons').every(([, value]) => value === 0)).toBe(true)
    expect(result.stats.fallbackReasons).toEqual([])
  })

  it('rejects a compiler module cached before installation instead of silently bypassing the control loader', () => {
    const result = runIsolated(`
      await import(${JSON.stringify(bindingUrl)});
      const { installCompileBatch } = await import(${JSON.stringify(installerUrl)});
      try {
        await installCompileBatch({ mode: 'control-js' });
        console.log(JSON.stringify({ rejected: false }));
      } catch (error) {
        console.log(JSON.stringify({
          rejected: /fresh process/.test(String(error)),
          hasGlobal: Object.hasOwn(globalThis, '__weappViteExperimentalCompileBindingBatch'),
        }));
      }
    `)
    expect(result).toEqual({ rejected: true, hasGlobal: false })
  })
})
