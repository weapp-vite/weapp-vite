import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
} from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { snapshotOutputCheckpoint } from '../packages/weapp-vite/scripts/utils/hmrDiagnosticEvidence'
import { createStatefulHmrControlSource } from '../packages/weapp-vite/src/runtime/statefulHmr/runtimeSource'

describe('diagnostic control output evidence', () => {
  it('compares real generated control code while excluding only validated session values', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'hmr-control-evidence-'))
    const control = { buildId: 'a'.repeat(32), token: 'b'.repeat(32), url: 'http://localhost:1234/__weapp_vite_stateful_hmr__' }
    const probe = { buildId: 'c'.repeat(32), token: 'd'.repeat(32), url: 'http://localhost:12345/__weapp_vite_stateful_hmr__' }
    try {
      const source = createStatefulHmrControlSource(control)
      const probeSource = createStatefulHmrControlSource(probe)
      for (const file of [WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE]) {
        await mkdir(path.dirname(path.join(root, file)), { recursive: true })
        await writeFile(path.join(root, file), '')
      }
      await writeFile(path.join(root, 'app.js'), `require('./${WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE}')`)
      const snapshot = async (code: string, registered = code) => {
        await writeFile(path.join(root, WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE), code)
        return snapshotOutputCheckpoint(root, { type: 'batch-published', targetVersion: 1 }, registered)
      }
      const before = await snapshot(source)
      const after = await snapshot(probeSource)
      expect(before.controlContract.canonicalSourceSha256).toBe(after.controlContract.canonicalSourceSha256)
      expect(before.controlContract.sourceBytes).not.toBe(after.controlContract.sourceBytes)
      expect(before.controlContract.sessionFieldFingerprints).not.toEqual(after.controlContract.sessionFieldFingerprints)
      expect(JSON.stringify(after)).not.toContain(probe.token)

      const changed = await snapshot(`${probeSource}\nvoid 'changed runtime behavior';`, probeSource)
      expect(changed.controlContract.canonicalSourceSha256).not.toBe(after.controlContract.canonicalSourceSha256)
      await expect(snapshot(probeSource, source)).rejects.toThrow('session registered')
      await expect(snapshot(createStatefulHmrControlSource({ ...probe, url: `${probe.url}?different=1` })))
        .rejects
        .toThrow('schema, shape')
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
