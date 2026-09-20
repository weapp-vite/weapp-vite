import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prepareDynamicReactMutation } from './dynamicReactDelivery'
import { StatefulHmrAuditClient } from './statefulAuditClient'

const marker = 'current-mutation'
const stamp = (id: string) => `// weapp-vite-stateful-build:${id}\n`

describe('explicit dynamic React audit delivery', () => {
  let root: string
  let batch: number | undefined
  let client: StatefulHmrAuditClient

  async function write(relative: string, source: string) {
    const filename = path.join(root, relative)
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, source)
  }

  async function emitBuild(id: string, text: string) {
    await write('__weapp_vite_hmr/control.js', `globalThis.control=${JSON.stringify({ buildId: id, token: 'test-token', url: 'http://localhost/control' })};`)
    await write('app.js', `${stamp(id)}void 0;`)
    await write('pages/index.js', `${stamp(id)}require('./render.js');`)
    await write('pages/render.js', `${stamp(id)}console.log(${JSON.stringify(text)});`)
    await write('__weapp_vite_hmr/update.js', 'void 0;')
  }

  async function prepare() {
    return await prepareDynamicReactMutation({
      client,
      distRoot: root,
      entryFile: path.join(root, 'pages/index.js'),
      timeoutMs: 120,
      intervalMs: 5,
    })
  }

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'dynamic-react-delivery-'))
    batch = undefined
    client = new StatefulHmrAuditClient(vi.fn(async (_input, init) => {
      const { action } = JSON.parse(String(init?.body)) as { action: string }
      return new Response(JSON.stringify(action === 'register'
        ? { type: 'registered' }
        : batch === undefined ? { type: 'idle' } : { type: 'batch-published', targetVersion: batch }))
    }), () => 'test-session')
    await emitBuild('before', 'baseline')
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('records a committed full reload from the current reachable page graph', async () => {
    const mutation = await prepare()
    await emitBuild('updated', marker)
    await expect(mutation.waitForDelivery(marker, true)).resolves.toEqual({
      delivery: 'full-reload',
      beforeBuildId: 'before',
      buildId: 'updated',
      entryBuildId: 'updated',
      output: 'pages/index.js',
      containsMarker: true,
    })
  })

  it('binds restore to a new pre-mutation identity and accepts only current reachable marker absence', async () => {
    const update = await prepare()
    await emitBuild('updated', marker)
    await update.waitForDelivery(marker, true)
    await expect(update.waitForDelivery(marker, false)).rejects.toThrow('fresh pre-mutation')
    const restore = await prepare()
    await emitBuild('restored', 'baseline')
    await write('unused.js', `console.log('${marker}')`)
    await expect(restore.waitForDelivery(marker, false)).resolves.toMatchObject({
      delivery: 'full-reload',
      beforeBuildId: 'updated',
      buildId: 'restored',
      containsMarker: false,
    })
  })

  it('accepts a same-build acknowledged patch without claiming full reload or state retention', async () => {
    const mutation = await prepare()
    await write('__weapp_vite_hmr/update.js', `console.log('${marker}')`)
    batch = 1
    await expect(mutation.waitForDelivery(marker, true)).resolves.toMatchObject({
      delivery: 'patch',
      beforeBuildId: 'before',
      buildId: 'before',
      targetVersion: 1,
      output: '__weapp_vite_hmr/update.js',
    })
  })

  it('allows restore patches to replace a factory while its full-build source remains on disk', async () => {
    await emitBuild('updated', marker)
    const restore = await prepare()
    await write('__weapp_vite_hmr/update.js', 'console.log("restored factory")')
    batch = 1
    await expect(restore.waitForDelivery(marker, false)).resolves.toMatchObject({ delivery: 'patch', buildId: 'updated' })
  })

  it('does not accept a previously acknowledged batch as restoration delivery', async () => {
    const mutation = await prepare()
    await write('__weapp_vite_hmr/update.js', `console.log('${marker}')`)
    batch = 1
    await mutation.waitForDelivery(marker, true)
    const restore = await prepare()
    await write('__weapp_vite_hmr/update.js', 'void 0;')
    await expect(restore.waitForDelivery(marker, false)).rejects.toThrow('Timed out')
  })

  it('does not accept changed emitted JS with an unchanged build identity and no patch acknowledgement', async () => {
    const mutation = await prepare()
    await write('pages/render.js', `console.log('${marker}')`)
    await expect(mutation.waitForDelivery(marker, true)).rejects.toThrow('Timed out')
  })

  it('does not accept a transport acknowledgement whose payload belongs to an earlier mutation', async () => {
    const mutation = await prepare()
    batch = 1
    await write('__weapp_vite_hmr/update.js', 'console.log("older mutation")')
    await expect(mutation.waitForDelivery(marker, true)).rejects.toThrow('Timed out')
  })

  it.each(['app.js', 'pages/index.js'])('rejects a new control while %s still belongs to the previous build', async (entry) => {
    const mutation = await prepare()
    await emitBuild('updated', marker)
    await write(entry, `${stamp('before')}console.log('${marker}')`)
    await expect(mutation.waitForDelivery(marker, true)).rejects.toThrow('one committed build')
  })

  it('does not accept an orphan marker outside the current page import graph', async () => {
    const mutation = await prepare()
    await emitBuild('updated', 'no current marker')
    await write('unused.js', `console.log('${marker}')`)
    await expect(mutation.waitForDelivery(marker, true)).rejects.toThrow('Timed out')
  })

  it.each(['missing dependency', 'invalid dependency', 'retained marker'])('rejects restoration with %s', async (failure) => {
    await emitBuild('updated', marker)
    const restore = await prepare()
    await emitBuild('restored', failure === 'retained marker' ? marker : 'baseline')
    if (failure === 'missing dependency') {
      await rm(path.join(root, 'pages/render.js'))
    }
    if (failure === 'invalid dependency') {
      await write('pages/render.js', 'export const = ;')
    }
    await expect(restore.waitForDelivery(marker, false)).rejects.toThrow('Timed out')
  })

  it('does not accept a missing page as successful restoration', async () => {
    await emitBuild('updated', marker)
    const restore = await prepare()
    await emitBuild('restored', 'baseline')
    await rm(path.join(root, 'pages/index.js'))
    await expect(restore.waitForDelivery(marker, false)).rejects.toThrow('Timed out')
  })

  it('rejects mutation preparation without a committed initial entry', async () => {
    await write('app.js', 'void 0;')
    await expect(prepare()).rejects.toThrow('Missing stateful full-build stamp')
  })
})
