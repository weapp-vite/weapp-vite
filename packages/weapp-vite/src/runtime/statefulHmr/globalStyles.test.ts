import type { StatefulHmrOutputFile } from './outputWriter'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import { afterEach, describe, expect, it } from 'vitest'
import { createStatefulHmrGlobalStyleAssets } from './globalStyles'
import { writeStatefulHmrOutput } from './outputWriter'
import { getChangedStatefulHmrSnapshotAssets, mergeStatefulHmrSnapshotAssets } from './session'

const styleFile = `${WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME}.wxss`
const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map(root => fs.remove(root)))
})

function snapshot(source?: string | Uint8Array) {
  return createStatefulHmrGlobalStyleAssets(source === undefined
    ? []
    : [
        { type: 'asset', fileName: 'app.wxss', source },
      ], 'wxss', { createIfMissing: true })
}

describe('stateful HMR global styles', () => {
  it('preserves original stylesheet bytes and relative imports beside a stable app entry', () => {
    const source = Buffer.from('@import "./styles/theme.wxss";\r\n.hero { background: url("./assets/banner.png"); }\n')
    const original: StatefulHmrOutputFile[] = [
      { type: 'asset', fileName: 'app.wxss', source },
      { type: 'asset', fileName: 'pages/index/index.wxss', source: '.local {}' },
    ]
    const output = createStatefulHmrGlobalStyleAssets(original, 'wxss')
    expect(original[0]).toEqual({ type: 'asset', fileName: 'app.wxss', source })
    expect(output).toContainEqual({ type: 'asset', fileName: 'app.wxss', source: `@import "./${styleFile}";\n` })
    expect(output).toContainEqual({ type: 'asset', fileName: styleFile, source })
    expect(output).toContain(original[1])
    expect(path.posix.dirname(styleFile)).toBe(path.posix.dirname('app.wxss'))
    expect(createStatefulHmrGlobalStyleAssets(output, 'wxss')).toBe(output)
  })

  it('uses the configured stylesheet extension and leaves unrelated partial output untouched', () => {
    const output: StatefulHmrOutputFile[] = [{ type: 'asset', fileName: 'update.js', source: 'void 0;' }]
    expect(createStatefulHmrGlobalStyleAssets(output, 'wxss')).toBe(output)
    const styles = createStatefulHmrGlobalStyleAssets([
      { type: 'asset', fileName: 'app.acss', source: '.app {}' },
    ], '.acss')
    expect(styles).toContainEqual({ type: 'asset', fileName: 'app.acss', source: `@import "./${WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME}.acss";\n` })
  })

  it('keeps the import entry unchanged when styles are added, replaced, or removed', () => {
    const empty = snapshot()
    const first = snapshot('.app { color: red; }')
    const next = snapshot('.app { color: blue; }')
    expect(getChangedStatefulHmrSnapshotAssets(empty, first)).toEqual([
      { type: 'asset', fileName: styleFile, source: '.app { color: red; }' },
    ])
    expect(getChangedStatefulHmrSnapshotAssets(first, next)).toEqual([
      { type: 'asset', fileName: styleFile, source: '.app { color: blue; }' },
    ])
    expect(getChangedStatefulHmrSnapshotAssets(next, empty)).toEqual([
      { type: 'asset', fileName: styleFile, source: '' },
    ])
    expect(getChangedStatefulHmrSnapshotAssets(next, snapshot('.app { color: blue; }'))).toEqual([])
  })

  it('merges the snapshot stylesheet into a full DevEngine output without restoring inline app styles', () => {
    const full: StatefulHmrOutputFile[] = [
      { type: 'chunk', fileName: 'app.js', code: 'App({})', modules: {} },
      { type: 'asset', fileName: 'app.wxss', source: '.stale {}' },
    ]
    const normalized = createStatefulHmrGlobalStyleAssets(full, 'wxss')
    mergeStatefulHmrSnapshotAssets(normalized, snapshot('.current {}'))
    expect(normalized).toContain(full[0])
    expect(normalized).toContainEqual({ type: 'asset', fileName: styleFile, source: '.current {}' })
    expect(normalized).toContainEqual({ type: 'asset', fileName: 'app.wxss', source: `@import "./${styleFile}";\n` })
  })

  it('rejects an existing asset at the owned stylesheet path', () => {
    expect(() => createStatefulHmrGlobalStyleAssets([
      { type: 'asset', fileName: 'app.wxss', source: '.app {}' },
      { type: 'asset', fileName: styleFile, source: '.user {}' },
    ], 'wxss')).toThrow('conflicts with emitted asset')
  })

  it('writes both initial assets through Vite and only writes the stylesheet on refresh', async () => {
    const root = await fs.mkdtemp(path.join(process.cwd(), '.tmp-stateful-global-style-'))
    tempRoots.push(root)
    const outDir = path.join(root, 'dist')
    const initial = snapshot('.app { color: red; }')
    await writeStatefulHmrOutput(outDir, initial)
    const entryFile = path.join(outDir, 'app.wxss')
    const preservedTime = new Date('2000-01-01T00:00:00.000Z')
    await fs.utimes(entryFile, preservedTime, preservedTime)
    const next = snapshot('.app { color: blue; }')
    await writeStatefulHmrOutput(outDir, getChangedStatefulHmrSnapshotAssets(initial, next))
    await expect(fs.readFile(path.join(outDir, styleFile), 'utf8')).resolves.toBe('.app { color: blue; }')
    await expect(fs.readFile(entryFile, 'utf8')).resolves.toBe(`@import "./${styleFile}";\n`)
    expect((await fs.stat(entryFile)).mtimeMs).toBe(preservedTime.getTime())
  })
})
