import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { redactSequenceEvidenceText } from './evidenceRedaction'
import { readSequenceProfile } from './profileEvidence'

it('requires actual completed events and retains diagnostic counts without local paths', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sequence-profile-'))
  try {
    expect((await readSequenceProfile(root)).samples).toEqual([])
    await mkdir(path.join(root, '.weapp-vite'))
    const file = path.join(root, 'src/page.vue')
    await writeFile(path.join(root, '.weapp-vite/hmr-profile.jsonl'), [
      JSON.stringify({ schemaVersion: 1, status: 'complete', totalMs: 12, file, sourceEvents: [{ eventId: 'source', file, receivedAtMs: 1 }] }),
      JSON.stringify({ schemaVersion: 1, status: 'failed', elapsedMs: 9 }),
      'invalid JSON',
      '',
    ].join('\n'))
    const evidence = await readSequenceProfile(root)
    expect(evidence.samples).toMatchObject([{ totalMs: 12, file: '<fixture>/src/page.vue', sourceEvents: [{ file: '<fixture>/src/page.vue' }] }])
    expect(evidence.coverage).toMatchObject({ compatible: 1, incomplete: 1, invalid: 1 })
    expect(evidence.skippedLineCount).toBe(2)
    expect(evidence.rawLines).toMatchObject([
      { line: 1, classification: 'compatible' },
      { line: 2, classification: 'incomplete', text: '{"schemaVersion":1,"status":"failed","elapsedMs":9}' },
      { line: 3, classification: 'invalid', text: 'invalid JSON' },
    ])
    expect(JSON.stringify(evidence)).not.toContain(root)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('redacts Windows UNC and rooted paths after repeated escaping or URL encoding', () => {
  const paths = ['\\\\private-server\\private share\\page.vue', '\\private-root\\page.vue']
  for (const file of paths) {
    for (const encoded of [file, JSON.stringify(file), JSON.stringify(JSON.stringify(file)), encodeURIComponent(encodeURIComponent(file))]) {
      const result = redactSequenceEvidenceText(`failed: ${encoded}`, os.tmpdir())
      expect(result).toContain('<external>')
      expect(result).not.toContain('private-server')
      expect(result).not.toContain('private share')
      expect(result).not.toContain('private-root')
    }
  }
})

it('retains rejected diagnostics while redacting nested, encoded and escaped paths in every field', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sequence-profile-'))
  try {
    await mkdir(path.join(root, '.weapp-vite'))
    const file = path.join(root, 'src/page.vue')
    const external = path.join(os.tmpdir(), 'external private-source', 'page.vue')
    const windows = 'C:\\Users\\private source\\page.vue'
    const lines = [
      JSON.stringify({ schemaVersion: 1, status: 'failed', reason: `compile failed: ${encodeURIComponent(encodeURIComponent(file))}`, nested: { stack: `at build (${JSON.stringify(windows)}:3:4)` } }),
      JSON.stringify({ schemaVersion: 2, status: 'complete', diagnostic: JSON.stringify({ file: external }) }),
      JSON.stringify({ schemaVersion: 1, status: 'complete', totalMs: 2, diagnostic: { unknownPath: `file://${external}`, [file]: windows } }),
      `broken JSON {"file":"${JSON.stringify(file).slice(1, -1).replaceAll('/', '\\u002f')}"`,
      `broken Windows {"file":${JSON.stringify(windows)}`,
      `broken encoded: ${encodeURIComponent(external)}`,
    ]
    await writeFile(path.join(root, '.weapp-vite/hmr-profile.jsonl'), lines.join('\r\n'))
    const evidence = await readSequenceProfile(root)
    expect(evidence.coverage).toEqual({ compatible: 1, legacy: 0, incomplete: 1, incompatible: 1, invalid: 3 })
    expect(evidence.rawLines).toHaveLength(lines.length)
    expect(evidence.rawLines[0]!.text).toContain('compile failed: <fixture>/src/page.vue')
    expect(evidence.rawLines[0]!.text).toContain('at build')
    expect(evidence.rawLines[3]!.text).toContain('<fixture>/src/page.vue')
    const saved = JSON.stringify(evidence)
    for (const secret of [root, external, windows, 'private source', 'private-source', encodeURIComponent(root)]) {
      expect(saved).not.toContain(secret)
    }
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
