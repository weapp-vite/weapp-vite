import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const installer = new URL('./install.ts', import.meta.url).href
const compiler = new URL('../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/index.ts', import.meta.url).href
const cwd = fileURLToPath(new URL('../../', import.meta.url))

function isolated(source: string): unknown {
  return JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', source], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }))
}

describe('script baseline installer lifecycle', () => {
  it.each(['control', 'optimized'] as const)('loads all six modules in a fresh %s process and releases the installer', (mode) => {
    const result = isolated(`
      const { installScriptBaseline } = await import(${JSON.stringify(installer)});
      const installed = await installScriptBaseline({ mode: ${JSON.stringify(mode)} });
      const sourceCount = Object.keys(installed.sourceHashes).length;
      const snapshot = installed.snapshot();
      installed.reset();
      installed.dispose();
      installed.dispose();
      console.log(JSON.stringify({ sourceCount, snapshot, hasGlobal: Object.hasOwn(globalThis, '__weappViteExperimentalScriptBaseline') }));
    `) as { sourceCount: number, snapshot: Record<string, number>, hasGlobal: boolean }
    expect(result.sourceCount).toBe(6)
    expect(Object.values(result.snapshot).every(value => value === 0)).toBe(true)
    expect(result.hasGlobal).toBe(false)
  })

  it('rejects previously imported compiler modules and cleans up the failed installation', () => {
    const result = isolated(`
      await import(${JSON.stringify(compiler)});
      const { installScriptBaseline } = await import(${JSON.stringify(installer)});
      try {
        await installScriptBaseline({ mode: 'optimized' });
        console.log(JSON.stringify({ rejected: false }));
      } catch (error) {
        console.log(JSON.stringify({ rejected: /fresh process/.test(String(error)), hasGlobal: Object.hasOwn(globalThis, '__weappViteExperimentalScriptBaseline') }));
      }
    `)
    expect(result).toEqual({ rejected: true, hasGlobal: false })
  })
})
