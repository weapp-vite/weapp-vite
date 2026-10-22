import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { measureStatefulTemplateArtifact } from '../../../../scripts/workspace-hmr/statefulArtifactMeasurement'
import { StatefulHmrAuditClient } from '../../../../scripts/workspace-hmr/statefulAuditClient'
import { createAutoImportHmrFallback } from './hmrFallback'

const requested = '[weapp-vite] HMR fallback {"from":"stateful-experimental","to":"classic","reason":"native-registration"}'
const ready = '[weapp-vite] HMR classic ready {"reason":"native-registration"}'

it('requires matching native-registration readiness and released runtime artifacts across phases', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'auto-import-fallback-'))
  const signal = new AbortController().signal
  let output = ''
  const fallback = createAutoImportHmrFallback(root, () => output)
  const settle = fallback.isClassicFallback
  try {
    await writeFile(path.join(root, 'app.js'), 'App({});')
    await writeFile(path.join(root, 'app.json'), '{"pages":[]}')
    expect(await settle(signal, Date.now() + 1_000)).toBe(false)
    expect(fallback.evidence).toBeUndefined()
    output = `${requested}\n${ready}`
    await mkdir(path.join(root, '__weapp_vite_hmr'))
    await writeFile(path.join(root, '__weapp_vite_hmr/control.js'), 'retired control')
    await expect(settle(signal, Date.now() + 1_000)).rejects.toThrow('retained stateful artifact')
    expect(fallback.evidence).toBeUndefined()
    await rm(path.join(root, '__weapp_vite_hmr'), { recursive: true })
    expect(await settle(signal, Date.now() + 1_000)).toBe(true)
    expect(fallback.actualMode).toBe('classic')
    expect(fallback.evidence).toEqual({ fallbackReason: 'native-registration', classicReadyVerified: true })
    expect(await settle(signal, Date.now() + 1_000)).toBe(true)
    const cancelled = new AbortController()
    cancelled.abort(new Error('cancelled mutation'))
    await expect(settle(cancelled.signal, Date.now() + 1_000)).rejects.toThrow('cancelled mutation')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('does not turn an unrelated fallback or unmatched readiness into successful delivery', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'auto-import-fallback-invalid-'))
  const signal = new AbortController().signal
  try {
    const unsupported = createAutoImportHmrFallback(root, () => requested.replace('native-registration', 'stylesheet-output'))
    await expect(unsupported.isClassicFallback(signal, Date.now() + 1_000)).rejects.toThrow('Unexpected auto-import HMR fallback: stylesheet-output')
    const unmatched = createAutoImportHmrFallback(root, () => `${requested}\n${ready.replace('native-registration', 'stylesheet-output')}`)
    await expect(unmatched.isClassicFallback(signal, Date.now() + 1_000)).rejects.toThrow('readiness does not match')
    const missingReady = createAutoImportHmrFallback(root, () => requested)
    await expect(missingReady.isClassicFallback(signal, Date.now())).rejects.toThrow('no matching ready transition')
    const diagnostic = createAutoImportHmrFallback(root, () => `${requested}\n${ready}`, true)
    await expect(diagnostic.isClassicFallback(signal, Date.now() + 1_000)).rejects.toThrow('stateful diagnostic cannot accept classic fallback')
    expect(() => diagnostic.assertDiagnosticRuntime()).toThrow('stateful diagnostic cannot accept classic fallback')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it.each([
  { output: '', error: 'poll failed with HTTP 410' },
  { output: requested.replace('native-registration', 'stylesheet-output'), error: 'Unexpected auto-import HMR fallback: stylesheet-output' },
])('rejects a retired transport without verified native-registration delivery: $error', async ({ output: retiredOutput, error }) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'auto-import-retirement-'))
  const control = { buildId: 'build-a', token: 'test-token', url: 'http://localhost/control' }
  let output = ''
  const client = new StatefulHmrAuditClient(async (_url, init) => {
    const request = JSON.parse(String(init?.body)) as { action: string }
    if (request.action === 'register') {
      return new Response(JSON.stringify({ type: 'registered', acknowledgement: 'explicit-v1' }))
    }
    output = retiredOutput
    return new Response('gone', { status: 410 })
  })
  try {
    await client.ensureRegistered(control, 1_000)
    const fallback = createAutoImportHmrFallback(root, () => output)
    await expect(measureStatefulTemplateArtifact({
      client,
      isClassicFallback: fallback.isClassicFallback,
      readControl: async () => control,
      isCurrentUpdate: async () => true,
      measure: async () => 42,
      timeoutMs: 1_000,
    })).rejects.toThrow(error)
    expect(fallback.evidence).toBeUndefined()
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
