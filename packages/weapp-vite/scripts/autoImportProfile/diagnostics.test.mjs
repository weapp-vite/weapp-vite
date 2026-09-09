import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
// eslint-disable-next-line test/no-import-node-test -- 诊断参数与脱敏错误的纯文本自测，不加载构建器或 E2E。
import { test } from 'node:test'
import { recordStartupError, selectProfilingComponents } from './diagnostics.mjs'

test('100-component scenario preserves the formal benchmark slice behavior', async () => {
  const components = JSON.parse(await readFile(new URL('../../src/auto-import-components/resolvers/json/vant.json', import.meta.url), 'utf8'))
  const tags = [...new Set(components.map(component => `van-${component}`))].sort()
  const selection = selectProfilingComponents(tags, 100)
  assert.equal(selection.requestedCount, 100)
  assert.equal(selection.actualCount, Math.min(100, tags.length))
  assert.deepEqual(selection.tags, tags.slice(0, 100))
  assert.throws(() => selectProfilingComponents(tags, 0))
  assert.throws(() => selectProfilingComponents(tags, 1.5))
})

test('startup errors remain actionable, sanitized and independent of existing samples', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'auto-import-error-'))
  try {
    const raw = path.join(root, 'raw')
    await mkdir(raw)
    await writeFile(path.join(raw, 'old.jsonl'), 'existing-evidence\n')
    const error = Object.assign(new Error(`EEXIST: mkdir '${raw}'; request http://localhost:8080/control?token=private-control-token`), { code: 'EEXIST' })
    const errorRoot = path.join(root, 'errors')
    for (let index = 0; index < 2; index++) {
      const report = await recordStartupError(error, { errorRoot, roots: [root], sha: 'fixture-sha' })
      assert.equal(report.error.code, 'EEXIST')
      assert.equal(report.error.name, 'Error')
      assert.match(report.error.message, /mkdir/)
    }
    const directories = await readdir(errorRoot)
    assert.equal(directories.length, 2)
    for (const directory of directories) {
      const text = await readFile(path.join(errorRoot, directory, 'error.json'), 'utf8')
      for (const secret of [root, 'localhost', 'private-control-token', 'stack']) {
        assert.equal(text.includes(secret), false)
      }
      assert.equal(JSON.parse(text).sha, 'fixture-sha')
    }
    assert.equal(await readFile(path.join(raw, 'old.jsonl'), 'utf8'), 'existing-evidence\n')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
