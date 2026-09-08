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

function pageStyle(global: string, local = '') {
  return `/* ${WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME}:start */\n${global}\n/* ${WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME}:end */\n${local}`
}

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

  it('prepends self-contained global rules only for confirmed component pages and preserves local precedence', () => {
    const localSource = Buffer.from('.probe { color: blue; }\r\n')
    const isolated: StatefulHmrOutputFile = { type: 'asset', fileName: 'pages/isolated/index.wxss', source: '.isolated {}' }
    const original: StatefulHmrOutputFile[] = [
      { type: 'asset', fileName: 'app.wxss', source: '.probe { color: red; }' },
      { type: 'asset', fileName: 'pages/index/index.wxss', source: localSource },
      isolated,
    ]
    const options = { componentPageGlobalStyleRoutes: ['pages/index/index', 'feature/pages/detail/index'] }
    const output = createStatefulHmrGlobalStyleAssets(original, 'wxss', options)
    expect(output).toContainEqual({
      type: 'asset',
      fileName: 'pages/index/index.wxss',
      source: pageStyle('.probe { color: red; }', '.probe { color: blue; }\r\n'),
    })
    expect(output).toContainEqual({
      type: 'asset',
      fileName: 'feature/pages/detail/index.wxss',
      source: pageStyle('.probe { color: red; }'),
    })
    expect(output).toContain(isolated)
    expect(original[1]).toEqual({ type: 'asset', fileName: 'pages/index/index.wxss', source: localSource })
    expect(createStatefulHmrGlobalStyleAssets(output, 'wxss', options)).toBe(output)
    const refreshed = createStatefulHmrGlobalStyleAssets(output.map<StatefulHmrOutputFile>(item => item.fileName === styleFile
      ? { type: 'asset', fileName: styleFile, source: '.probe { color: orange; }' }
      : item), 'wxss', options)
    expect(refreshed).toContainEqual({
      type: 'asset',
      fileName: 'pages/index/index.wxss',
      source: pageStyle('.probe { color: orange; }', '.probe { color: blue; }\r\n'),
    })
  })

  it('normalizes route separators without changing dotted route names or style extensions', () => {
    const output = createStatefulHmrGlobalStyleAssets([], '.acss', {
      createIfMissing: true,
      componentPageGlobalStyleRoutes: ['feature\\pages\\index.v2', '/feature/pages/index.v2'],
    })
    const pageAssets = output.filter(item => item.fileName === 'feature/pages/index.v2.acss')
    expect(pageAssets).toEqual([{
      type: 'asset',
      fileName: 'feature/pages/index.v2.acss',
      source: pageStyle(''),
    }])
  })

  it('clears removed global-only pages through emitted empty assets and restores existing local styles', () => {
    const routes = ['pages/empty/index', 'pages/styled/index']
    const previous = createStatefulHmrGlobalStyleAssets([
      { type: 'asset', fileName: 'pages/styled/index.wxss', source: '.local {}' },
    ], 'wxss', { createIfMissing: true, componentPageGlobalStyleRoutes: routes })
    const options = { createIfMissing: true, previousComponentPageGlobalStyleRoutes: routes }
    const next = createStatefulHmrGlobalStyleAssets([
      { type: 'asset', fileName: 'pages/styled/index.wxss', source: '.local {}' },
    ], 'wxss', options)
    expect(getChangedStatefulHmrSnapshotAssets(previous, next)).toEqual(expect.arrayContaining([
      { type: 'asset', fileName: 'pages/empty/index.wxss', source: '' },
      { type: 'asset', fileName: 'pages/styled/index.wxss', source: '.local {}' },
    ]))
    expect(createStatefulHmrGlobalStyleAssets(previous, 'wxss', options)).toEqual(expect.arrayContaining([
      { type: 'asset', fileName: 'pages/empty/index.wxss', source: '' },
      { type: 'asset', fileName: 'pages/styled/index.wxss', source: '.local {}' },
    ]))
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

  it('invalidates page content from global and imported source changes and writes the actual rules through Vite', async () => {
    const root = await fs.mkdtemp(path.join(process.cwd(), '.tmp-stateful-global-style-'))
    tempRoots.push(root)
    const route = 'pages/shared/index'
    const options = { componentPageGlobalStyleRoutes: [route] }
    function withDependency(color: string, global = '.global { display: block; }') {
      return createStatefulHmrGlobalStyleAssets([
        { type: 'asset', fileName: 'app.wxss', source: `@import "./styles/theme.wxss"; ${global}` },
        { type: 'asset', fileName: 'styles/theme.wxss', source: `.probe { color: ${color}; background: url(./a.png); }` },
        { type: 'asset', fileName: `${route}.wxss`, source: '.probe { color: green; }' },
      ], 'wxss', options)
    }
    const initial = withDependency('red')
    await writeStatefulHmrOutput(root, initial)
    const next = withDependency('blue')
    const diff = getChangedStatefulHmrSnapshotAssets(initial, next)
    expect(diff.map(item => item.fileName).sort()).toEqual([`${route}.wxss`, 'styles/theme.wxss'])
    await writeStatefulHmrOutput(root, diff)
    const page = await fs.readFile(path.join(root, `${route}.wxss`), 'utf8')
    expect(page).toContain('.probe { color: blue; background: url(../../styles/a.png); }')
    expect(page).not.toContain('@import')
    expect(page.endsWith('.probe { color: green; }')).toBe(true)
    expect(createStatefulHmrGlobalStyleAssets(next, 'wxss', options)).toBe(next)
    expect(getChangedStatefulHmrSnapshotAssets(next, withDependency('blue', '.global { display: none; }')).map(item => item.fileName).sort())
      .toEqual([`${route}.wxss`, styleFile].sort())
    const removed = withDependency('blue', '')
    expect(getChangedStatefulHmrSnapshotAssets(next, removed)).toContainEqual(expect.objectContaining({
      fileName: `${route}.wxss`,
      source: expect.not.stringContaining('.global'),
    }))
  })

  it('removes an obsolete page global snapshot on disk through the Vite writer', async () => {
    const root = await fs.mkdtemp(path.join(process.cwd(), '.tmp-stateful-global-style-'))
    tempRoots.push(root)
    const route = 'pages/index/index'
    const initial = createStatefulHmrGlobalStyleAssets([], 'wxss', {
      createIfMissing: true,
      componentPageGlobalStyleRoutes: [route],
    })
    await writeStatefulHmrOutput(root, initial)
    const next = createStatefulHmrGlobalStyleAssets([], 'wxss', {
      createIfMissing: true,
      previousComponentPageGlobalStyleRoutes: [route],
    })
    await writeStatefulHmrOutput(root, getChangedStatefulHmrSnapshotAssets(initial, next))
    await expect(fs.readFile(path.join(root, `${route}.wxss`), 'utf8')).resolves.toBe('')
  })
})
