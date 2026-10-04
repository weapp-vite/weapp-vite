import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { inlineOriginTargets } from './source'

it('instruments actual tsx module loads beneath the optimized compiler owner in a fresh process', () => {
  const repository = new URL('../../../', import.meta.url)
  const code = `
    const { installInlineOrigins } = await import(${JSON.stringify(new URL('./index.ts', import.meta.url).href)});
    const { createOptimizedCompilerExecution } = await import(${JSON.stringify(new URL('../../optimizedCompilerAnalysis/execution.ts', import.meta.url).href)});
    const origins = installInlineOrigins();
    let execution;
    try {
      execution = await createOptimizedCompilerExecution('optimized-js');
      origins.assertInstalled();
      console.log(JSON.stringify(origins.snapshot()));
    } finally {
      try { execution?.dispose(); } finally { origins.dispose(); }
    }
  `
  const snapshot: unknown = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], {
    cwd: fileURLToPath(repository),
    env: { ...process.env, WEAPP_VITE_NATIVE: '0' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30000,
  }))
  expect(snapshot).toMatchObject({ templateCalls: 0, directiveCalls: 0, parsedCalls: 0, registeredCalls: 0, loaders: inlineOriginTargets.map(({ target }) => ({
    target,
    loadCount: 1,
    upstreamSha256: expect.stringMatching(/^[a-f\d]{64}$/),
    instrumentedSha256: expect.stringMatching(/^[a-f\d]{64}$/),
  })) })
})
