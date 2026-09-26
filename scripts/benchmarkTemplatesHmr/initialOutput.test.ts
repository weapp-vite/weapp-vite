import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { waitForBenchmarkInitialOutputs } from './initialOutput'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

async function outputFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'benchmark-initial-output-'))
  roots.push(root)
  return root
}

describe('benchmark initial output readiness', () => {
  it('waits for every planned page output after app.json is already present', async () => {
    const root = await outputFixture()
    const outputs = ['app.json', 'index.js', 'index.wxml', 'index.wxss'].map(label => ({ filename: path.join(root, label), label }))
    await fs.writeFile(outputs[0]!.filename, '{}')
    let ready = false
    const pending = waitForBenchmarkInitialOutputs(outputs, { timeoutMs: 2_000, intervalMs: 5 }).then(() => {
      ready = true
    })
    await fs.writeFile(outputs[1]!.filename, 'Page({})')
    await fs.writeFile(outputs[2]!.filename, '<view>ready</view>')
    await new Promise(resolve => setTimeout(resolve, 25))
    expect(ready).toBe(false)
    await fs.writeFile(outputs[3]!.filename, '')
    await pending
    expect(ready).toBe(true)
  })

  it('reports missing planned outputs instead of silently filtering cases', async () => {
    const root = await outputFixture()
    const filename = path.join(root, 'page.js')
    await expect(waitForBenchmarkInitialOutputs([{ filename, label: 'vue-page-script' }], { timeoutMs: 30, intervalMs: 5 }))
      .rejects
      .toThrow('Timed out waiting for initial benchmark outputs: vue-page-script')
  })

  it('propagates read errors immediately without exposing machine paths', async () => {
    const root = await outputFixture()
    await expect(waitForBenchmarkInitialOutputs([{ filename: root, label: 'vue-page-script' }], { timeoutMs: 2_000 }))
      .rejects
      .toThrow('Cannot read initial benchmark output vue-page-script: EISDIR')
  })

  it('rejects an empty initial output plan', async () => {
    await expect(waitForBenchmarkInitialOutputs([], { timeoutMs: 100 })).rejects.toThrow('must not be empty')
  })
})
