import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
// eslint-disable-next-line test/no-import-node-test -- 纯文本脱敏自测独立运行，避免加载仓库 Vitest 构建与 E2E 配置。
import { test } from 'node:test'
import { sanitizeDirectory } from './sanitize.mjs'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')

test('sanitizes encoded roots, tokens and local origins while preserving event order and hash references', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'hmr-sanitize-'))
  try {
    const input = path.join(root, 'raw')
    const output = path.join(root, 'artifact')
    await mkdir(path.join(input, 'blobs'), { recursive: true })
    const windows = 'C:\\Users\\fixture\\repo'
    const unix = '/home/runner/work/fixture/fixture'
    const token = 'token-value/+?abcd'
    const origin = 'http://127.0.0.1:9999'
    const control = JSON.stringify({ token, url: `${origin}/transport`, entry: `${windows}\\src\\components\\info-card.vue` })
    const controlHash = hash(control)
    const timeline = JSON.stringify([
      { stage: 'restore', entryIds: [`${unix}/src/components/info-card.vue`], hash: controlHash },
      { stage: 'template', entryIds: [`${unix}/src/pages/tsx-basic.tsx`], hash: controlHash },
    ])
    const log = [
      JSON.stringify({ nested: control }),
      `path=${encodeURIComponent(`${windows}\\src\\components\\info-card.vue`)}`,
      `path=${encodeURIComponent(encodeURIComponent(`${unix}/src/pages/tsx-basic.tsx`))}`,
      `request=${encodeURIComponent(`${origin}/transport?token=${token}`)}`,
      `lowercase=${encodeURIComponent(unix).replaceAll('%2F', '%2f')}/src/app.ts`,
      `isolated=${encodeURIComponent('http://localhost:8765/control?token=isolated-secret&event=ready')}`,
      'inspector=ws://127.0.0.1:54321/session',
    ].join('\n')
    await writeFile(path.join(input, 'blobs', controlHash), control)
    await writeFile(path.join(input, 'timeline.json'), timeline)
    await writeFile(path.join(input, 'dev.log'), log)
    const manifest = await sanitizeDirectory(input, output, { roots: [windows, unix] })
    const sanitizedLog = await readFile(path.join(output, 'dev.log'), 'utf8')
    assert.equal(sanitizedLog.includes('fixture'), false)
    assert.equal(sanitizedLog.includes('token-value'), false)
    assert.equal(sanitizedLog.includes('127.0.0.1'), false)
    assert.equal(sanitizedLog.includes('isolated-secret'), false)
    assert.equal(sanitizedLog.includes('localhost'), false)
    assert.equal(sanitizedLog.includes('<repo>'), true)
    assert.equal(sanitizedLog.includes('info-card.vue'), true)
    assert.equal(sanitizedLog.includes('tsx-basic.tsx'), true)
    const nested = JSON.parse(JSON.parse(sanitizedLog.split('\n')[0]).nested)
    assert.equal(nested.token, '<token>')
    assert.equal(nested.url, '<local-origin>/transport')
    const events = JSON.parse(await readFile(path.join(output, 'timeline.json'), 'utf8'))
    assert.deepEqual(events.map(event => event.stage), ['restore', 'template'])
    assert.deepEqual(events.map(event => event.entryIds[0]), ['<repo>/src/components/info-card.vue', '<repo>/src/pages/tsx-basic.tsx'])
    assert.equal(events[0].hash, controlHash)
    for (const file of manifest.files) {
      assert.equal(file.rawSha256, hash(await readFile(path.join(input, file.rawPath))))
      assert.equal(file.sanitizedSha256, hash(await readFile(path.join(output, file.sanitizedPath))))
    }
    assert.equal(await readFile(path.join(input, 'blobs', controlHash), 'utf8'), control)
    await assert.rejects(sanitizeDirectory(input, output, { roots: [windows, unix] }))
  }
  finally { await rm(root, { recursive: true, force: true }) }
})

test('missing or empty raw input fails without creating a successful artifact', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'hmr-sanitize-empty-'))
  try {
    const output = path.join(root, 'artifact')
    await assert.rejects(sanitizeDirectory(path.join(root, 'missing'), output), /missing or unreadable/)
    await assert.rejects(readFile(path.join(output, 'sanitization-manifest.json')))
    await mkdir(path.join(root, 'empty'))
    await assert.rejects(sanitizeDirectory(path.join(root, 'empty'), output), /input is empty/)
    await assert.rejects(readFile(path.join(output, 'sanitization-manifest.json')))
  }
  finally { await rm(root, { recursive: true, force: true }) }
})
