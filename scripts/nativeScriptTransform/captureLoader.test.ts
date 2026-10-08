import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { instrumentTransformScriptCapture } from './captureSource'

const installer = new URL('./captureLoader.ts', import.meta.url).href
const cwd = fileURLToPath(new URL('../../', import.meta.url))

function isolated(source: string): unknown {
  return JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', source], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }))
}

describe('capture load hook composition without a real compiler', () => {
  it('wraps a later shortCircuit owner exactly once and preserves that owner on disposal', () => {
    const result = isolated(`
      import { registerHooks } from 'node:module';
      const { installCaptureLoader } = await import(${JSON.stringify(installer)});
      const target = 'data:text/javascript,export%20default%200';
      let ownedLoads = 0;
      let capturedLoads = 0;
      const capture = installCaptureLoader(target, 'synthetic-module', source => {
        capturedLoads++;
        if (source !== 'export default 42') throw new Error('Original owner was bypassed');
        return source + '; export const captured = true';
      });
      const owner = registerHooks({ load(url, context, nextLoad) {
        if (url.startsWith('data:text/javascript,')) {
          ownedLoads++;
          return { format: 'module', shortCircuit: true, source: 'export default 42' };
        }
        return nextLoad(url, context);
      }});
      try {
        let rejectedBefore = false;
        try { capture.assertInstalled(); } catch { rejectedBefore = true; }
        const result = await import(target);
        capture.assertInstalled();
        const snapshot = capture.snapshot();
        capture.dispose(); capture.dispose();
        const after = await import(target + ';');
        console.log(JSON.stringify({ rejectedBefore, captured: result.captured, value: result.default, after: after.default, ownedLoads, capturedLoads, snapshot }));
      } finally { capture.dispose(); owner.deregister(); }
    `)
    expect(result).toMatchObject({ rejectedBefore: true, captured: true, value: 42, after: 42, ownedLoads: 2, capturedLoads: 1, snapshot: { loadCount: 1, target: 'synthetic-module' } })
    expect(result).toMatchObject({ snapshot: { upstreamSha256: expect.stringMatching(/^[a-f\d]{64}$/), instrumentedSha256: expect.stringMatching(/^[a-f\d]{64}$/) } })
  })

  it('rejects a cached module that did not run the capture load hook', () => {
    const result = isolated(`
      const { installCaptureLoader } = await import(${JSON.stringify(installer)});
      const target = 'data:text/javascript,export%20default%201';
      await import(target);
      const capture = installCaptureLoader(target, 'cached-synthetic', source => source);
      try {
        await import(target);
        let error;
        try { capture.assertInstalled(); } catch (cause) { error = String(cause); }
        console.log(JSON.stringify({ error, snapshot: capture.snapshot() }));
      } finally { capture.dispose(); }
    `)
    expect(result).toMatchObject({ error: expect.stringContaining('fresh process'), snapshot: { loadCount: 0 } })
  })

  it('refuses an unsupported capture anchor without stealing owner cleanup', () => {
    const result = isolated(`
      import { registerHooks } from 'node:module';
      const { installCaptureLoader } = await import(${JSON.stringify(installer)});
      const target = 'data:text/javascript,export%20default%202';
      const capture = installCaptureLoader(target, 'bad-synthetic', () => { throw new Error('anchor mismatch'); });
      const owner = registerHooks({ load(url, context, nextLoad) {
        return url === target ? { format: 'module', shortCircuit: true, source: 'export default 2' } : nextLoad(url, context);
      }});
      try {
        let error;
        try { await import(target); } catch (cause) { error = String(cause); }
        let rejected = false;
        try { capture.assertInstalled(); } catch { rejected = true; }
        console.log(JSON.stringify({ error, rejected, snapshot: capture.snapshot() }));
      } finally { capture.dispose(); capture.dispose(); owner.deregister(); }
    `)
    expect(result).toMatchObject({ error: expect.stringContaining('anchor mismatch'), rejected: true, snapshot: { loadCount: 1 } })
  })
})

describe('capture source guards', () => {
  const source = `
    const fastResult = measureCompilerStage('transformScript.fastSetup', () => tryFastTransformCompiledScriptSetup(source, options))
    const warn = resolveWarnHandler(options?.warn)
    return measureCompilerStage('transformScript', () => transformScriptInternal(source, options))
  `

  it('wraps all three declared boundaries without replacing the existing parse owner', () => {
    const output = instrumentTransformScriptCapture(source)
    expect(output).toContain('.invoke(source, options, () => measureCompilerStage')
    expect(output).toContain('.fastSetup(Boolean(fastResult))')
    expect(output).toContain('.warningHandler(resolveWarnHandler(options?.warn))')
  })

  it('rejects missing, repeated or already-instrumented anchors', () => {
    expect(() => instrumentTransformScriptCapture('changed')).toThrow('anchor changed')
    expect(() => instrumentTransformScriptCapture(source + source)).toThrow('anchor changed')
    expect(() => instrumentTransformScriptCapture(instrumentTransformScriptCapture(source))).toThrow('anchor changed')
  })

  it('matches the checked-in source text after type stripping without importing or running it', () => {
    const raw = readFileSync(new URL('../../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/index.ts', import.meta.url), 'utf8')
    const output = instrumentTransformScriptCapture(stripTypeScriptTypes(raw, { mode: 'strip' }))
    expect(output).toContain('.fastSetup(Boolean(fastResult))')
    expect(output).toContain('.invoke(source, options,')
  })
})
