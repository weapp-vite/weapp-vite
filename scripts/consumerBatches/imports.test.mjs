import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runImportsConsumer } from './imports.mjs'
import { importsReceipt } from './testFixture.mjs'

const roots = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function outputFile() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'imports-consumer-contract-'))
  roots.push(root)
  return path.join(root, 'evidence.json')
}

describe('independent imports consumer CI entry', () => {
  it.each(['wv', 'vite', 'vite-plus'])('holds the machine command scope and preserves exact evidence for %s', async (host) => {
    const output = await outputFile()
    const original = `${JSON.stringify(importsReceipt(host), null, 2)}\n`
    const execute = vi.fn(async (_command, _args, options) => {
      await writeFile(options.env.WEAPP_VITE_IMPORTS_EVIDENCE, original)
      return { exitCode: 0 }
    })
    const evidence = await runImportsConsumer(host, output, { execute })
    expect(execute).toHaveBeenCalledExactlyOnceWith(process.execPath, [
      '--import',
      'tsx',
      'e2e/scripts/run-e2e-commands.ts',
      process.execPath,
      'packages/weapp-vite/scripts/consumerImports/install.mjs',
      host,
      ...(host === 'wv' ? ['headless'] : []),
    ], expect.objectContaining({ reject: false, env: { WEAPP_VITE_IMPORTS_EVIDENCE: `${output}.imports.json` } }))
    expect(evidence).toMatchObject({ schemaVersion: 1, node: process.version, platform: process.platform, arch: process.arch, toolchain: host, imports: importsReceipt(host) })
    expect(evidence.importsSha256).toBe(createHash('sha256').update(original).digest('hex'))
    expect(JSON.parse(await readFile(output, 'utf8'))).toEqual(evidence)
    expect(await readFile(`${output}.imports.json`, 'utf8')).toBe(original)
  })

  it('preserves a failed process and refuses stale successful evidence', async () => {
    const output = await outputFile()
    await writeFile(output, 'stale successful envelope')
    await writeFile(`${output}.imports.json`, JSON.stringify(importsReceipt('vite')))
    const execute = vi.fn(async (_command, _args, options) => {
      await expect(readFile(output)).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(readFile(options.env.WEAPP_VITE_IMPORTS_EVIDENCE)).rejects.toMatchObject({ code: 'ENOENT' })
      await writeFile(options.env.WEAPP_VITE_IMPORTS_EVIDENCE, JSON.stringify({ ...importsReceipt('vite'), checks: [] }))
      return { exitCode: 1 }
    })
    await expect(runImportsConsumer('vite', output, { execute })).rejects.toThrow('Imports consumer failed: vite')
    await expect(readFile(output)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(JSON.parse(await readFile(`${output}.imports.json`, 'utf8')).checks).toEqual([])
  })

  it.each(['incomplete', 'patched', 'missing-headless'])('rejects %s receipts even after a zero process exit', async (kind) => {
    const output = await outputFile()
    const receipt = importsReceipt('wv')
    if (kind === 'incomplete') {
      receipt.checks = []
    }
    else if (kind === 'patched') {
      receipt.dependencies[0].patched = true
    }
    else {
      receipt.checks = receipt.checks.filter(check => !check.startsWith('headless'))
    }
    const execute = async (_command, _args, options) => {
      await writeFile(options.env.WEAPP_VITE_IMPORTS_EVIDENCE, JSON.stringify(receipt))
      return { exitCode: 0 }
    }
    await expect(runImportsConsumer('wv', output, { execute })).rejects.toThrow(/Imports consumer/)
    await expect(readFile(output)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
