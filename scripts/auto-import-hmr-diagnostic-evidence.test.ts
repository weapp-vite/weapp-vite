import type { StatefulHmrOutputFile } from '../packages/weapp-vite/src/runtime/statefulHmr/outputWriter'
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
import { stampStatefulHmrFullBuild } from '../packages/weapp-vite/src/runtime/statefulHmr/session'
import { renderBatch } from '../packages/weapp-vite/src/runtime/statefulHmr/transport'

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

  it('canonicalizes only the registered full-build stamp while retaining raw chunk hashes', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'hmr-build-stamp-evidence-'))
    try {
      const snapshot = async (buildId: string, token: string, port: number, nonce: string, body: string) => {
        const output = [{ type: 'chunk', fileName: 'app.js', code: body }] as unknown as StatefulHmrOutputFile[]
        stampStatefulHmrFullBuild(output, buildId)
        const control = { buildId, token, url: `http://localhost:${port}/__weapp_vite_stateful_hmr__` }
        await writeFile(path.join(root, 'app.js'), output[0]!.code)
        await writeFile(path.join(root, WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE), createStatefulHmrControlSource(control))
        await writeFile(path.join(root, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE), renderBatch({
          buildId,
          deltas: [{ changedIds: ['src/pages/index.vue'], code: `const payload = ${body.includes('payload = 2') ? '2' : '1'};\n` }],
          fromVersion: 0,
          targetVersion: 1,
        }, nonce))
        return snapshotOutputCheckpoint(root, { type: 'batch-published', targetVersion: 1 }, createStatefulHmrControlSource(control))
      }
      const writeRegisteredControl = async (buildId: string, token: string, port: number) => {
        const source = createStatefulHmrControlSource({ buildId, token, url: `http://localhost:${port}/__weapp_vite_stateful_hmr__` })
        await writeFile(path.join(root, WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE), source)
        return source
      }
      for (const file of [WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE]) {
        await mkdir(path.dirname(path.join(root, file)), { recursive: true })
        await writeFile(path.join(root, file), '')
      }
      await mkdir(path.dirname(path.join(root, 'app.js')), { recursive: true })
      await writeFile(path.join(root, 'app.js'), '')
      await writeFile(path.join(root, 'app.js'), `require('./${WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE}')`)

      const first = await snapshot('a'.repeat(32), 'b'.repeat(32), 1234, '1'.repeat(32), `require('./${WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE}')\nconst payload = 1;\n`)
      const second = await snapshot('c'.repeat(32), 'd'.repeat(32), 12345, '2'.repeat(32), `require('./${WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE}')\nconst payload = 1;\n`)
      const firstChunk = first.files['app.js']!
      const secondChunk = second.files['app.js']!
      expect(firstChunk.sha256).not.toBe(secondChunk.sha256)
      expect(firstChunk.bytes).toBe(secondChunk.bytes)
      expect(firstChunk.normalized).toBe('registered-stateful-build-id-first-line')
      expect(secondChunk.normalized).toBe('registered-stateful-build-id-first-line')
      expect(firstChunk.canonicalSha256).toBe(secondChunk.canonicalSha256)
      expect(firstChunk.canonicalBytes).toBe(secondChunk.canonicalBytes)
      const firstUpdate = first.files[WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE]!
      const secondUpdate = second.files[WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE]!
      expect(firstUpdate.sha256).not.toBe(secondUpdate.sha256)
      expect(firstUpdate.normalized).toBe('registered-stateful-hmr-batch-nonce-and-build-id')
      expect(secondUpdate.normalized).toBe('registered-stateful-hmr-batch-nonce-and-build-id')
      expect(firstUpdate.canonicalSha256).toBe(secondUpdate.canonicalSha256)

      const changedBody = await snapshot('e'.repeat(32), 'f'.repeat(32), 12346, '3'.repeat(32), `require('./${WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE}')\nconst payload = 2;\n`)
      expect(firstChunk.canonicalSha256).not.toBe(changedBody.files['app.js']!.canonicalSha256)
      expect(firstUpdate.canonicalSha256).not.toBe(changedBody.files[WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE]!.canonicalSha256)

      const unknownBuildId = '9'.repeat(32)
      const unknownIdControl = await writeRegisteredControl('7'.repeat(32), '8'.repeat(32), 12347)
      await writeFile(path.join(root, 'app.js'), `// weapp-vite-stateful-build:${unknownBuildId}\nrequire('./${WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE}')\nconst payload = 1;\n`)
      const unknownId = await snapshotOutputCheckpoint(root, { type: 'batch-published', targetVersion: 1 }, unknownIdControl)
      expect(unknownId.files['app.js']).not.toHaveProperty('normalized')

      const unknownPositionControl = await writeRegisteredControl('7'.repeat(32), '8'.repeat(32), 12347)
      await writeFile(path.join(root, 'app.js'), `/* preceding text */\n// weapp-vite-stateful-build:${'7'.repeat(32)}\nrequire('./${WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE}')\nconst payload = 1;\n`)
      const unknownPosition = await snapshotOutputCheckpoint(root, { type: 'batch-published', targetVersion: 1 }, unknownPositionControl)
      expect(unknownPosition.files['app.js']).not.toHaveProperty('normalized')

      const invalidUpdateControl = await writeRegisteredControl('7'.repeat(32), '8'.repeat(32), 12347)
      const wrongBuildBatch = renderBatch({
        buildId: '9'.repeat(32),
        deltas: [{ changedIds: ['src/pages/index.vue'], code: 'const payload = 1;\n' }],
        fromVersion: 0,
        targetVersion: 1,
      }, '6'.repeat(32))
      await writeFile(path.join(root, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE), wrongBuildBatch)
      const invalidUpdate = await snapshotOutputCheckpoint(root, { type: 'batch-published', targetVersion: 1 }, invalidUpdateControl)
      expect(invalidUpdate.files[WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE]).not.toHaveProperty('normalized')

      const trailingUpdate = `${renderBatch({
        buildId: '7'.repeat(32),
        deltas: [{ changedIds: ['src/pages/index.vue'], code: 'const payload = 1;\n' }],
        fromVersion: 0,
        targetVersion: 1,
      }, '6'.repeat(32))}void 0;\n`
      await writeFile(path.join(root, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE), trailingUpdate)
      const extraTextUpdate = await snapshotOutputCheckpoint(root, { type: 'batch-published', targetVersion: 1 }, invalidUpdateControl)
      expect(extraTextUpdate.files[WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE]).not.toHaveProperty('normalized')
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
