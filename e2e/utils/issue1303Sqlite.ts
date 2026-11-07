import type { startIssueClassicDev } from './issueClassicDev'
import { createHash } from 'node:crypto'
import { access, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect } from 'vitest'
import { createHeadlessSession } from '../../mpcore/packages/simulator/src/runtime'
import { replaceFileByRename, waitForFileContains } from './hmr-helpers'
import { assertClassicDevRemainsStable, assertIssuePageArtifacts, waitForIssuePublication } from './issueClassicDev'
import { createIssueRegressionProject } from './issueRegressionProject'

export type Issue1303PackageMode = 'existing-subpackage' | 'generated-subpackage'
export const ISSUE_1303_ROUTE = '/pages/index/index'
export const ISSUE_1303_ENGINE = 'sql.js-wasm-lite'

async function filesBelow(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(entry => entry.isDirectory()
    ? filesBelow(path.join(directory, entry.name))
    : [path.join(directory, entry.name)]))
  return nested.flat()
}

export async function createIssue1303Project(mode: Issue1303PackageMode) {
  const project = await createIssueRegressionProject(1303)
  if (mode === 'generated-subpackage') {
    const configPath = path.join(project, 'weapp-vite.config.ts')
    const config = await readFile(configPath, 'utf8')
    await writeFile(configPath, config.replace('mode: \'existing-subpackage\', root: \'shared\'', 'mode: \'generated-subpackage\', root: \'sqlite-engine\''))
    await rm(path.join(project, 'src/app.json'))
    await writeFile(path.join(project, 'src/app.json.ts'), [
      'import { subPackages } from \'weapp-vite/auto-routes\'',
      'import { defineAppJson } from \'weapp-vite/json\'',
      '',
      'export default defineAppJson({',
      '  pages: [\'pages/index/index\'],',
      '  subPackages,',
      '  window: { navigationBarTitleText: \'Issue 1303 generated\' },',
      '  style: \'v2\',',
      '  renderer: \'webview\',',
      '})',
      '',
    ].join('\n'))
    const privatePath = path.join(project, 'project.private.config.json')
    const privateConfig = JSON.parse(await readFile(privatePath, 'utf8')) as {
      condition: { miniprogram: { list: Array<{ name: string, pathName: string, query: string, launchMode: string }> } }
    }
    privateConfig.condition.miniprogram.list = [
      { name: 'issue-1303-main', pathName: 'pages/index/index', query: '', launchMode: 'default' },
      { name: 'issue-1303-generated-engine', pathName: 'sqlite-engine/entry/index', query: '', launchMode: 'default' },
    ]
    await writeFile(privatePath, `${JSON.stringify(privateConfig, null, 2)}\n`)
  }
  return project
}

/** 检查实际分包资源与静态 require.async 引用，不绑定打包器的共享 chunk 名。 */
export async function assertIssue1303Artifacts(project: string, mode: Issue1303PackageMode) {
  const root = mode === 'existing-subpackage' ? 'shared' : 'sqlite-engine'
  const dist = path.join(project, 'dist')
  const app = await assertIssuePageArtifacts(project)
  expect(app.subPackages ?? app.subpackages).toContainEqual(expect.objectContaining({ root }))
  const wasm = await readFile(path.join(dist, root, 'assets/sql-wasm-lite.wasm'))
  expect([...wasm.subarray(0, 4)]).toEqual([0, 97, 115, 109])
  expect(wasm.byteLength).toBeGreaterThan(8)
  let lazyReferences = 0
  for (const file of (await filesBelow(dist)).filter(file => file.endsWith('.js'))) {
    const source = await readFile(file, 'utf8')
    for (const match of source.matchAll(/require\.async\(\s*(['"])([^'"]+)\1\s*\)/g)) {
      const target = path.resolve(path.dirname(file), match[2]!)
      const relative = path.relative(dist, target).replaceAll('\\', '/')
      expect(relative.startsWith('../')).toBe(false)
      expect(relative.split('/').some(segment => /^__.*__$/.test(segment))).toBe(false)
      await access(target)
      if (relative.startsWith(`${root}/`)) {
        lazyReferences += 1
      }
    }
  }
  expect(lazyReferences, 'SQLite initializer must remain a real emitted lazy subpackage module').toBeGreaterThan(0)
}

async function ownedSourceSnapshot(project: string) {
  const sourceRoot = path.join(project, 'src')
  const all = await filesBelow(sourceRoot)
  const ownedDirectories = all.filter(file => path.basename(file) === '.weapp-sqlite-generated').map(file => path.dirname(file))
  expect(ownedDirectories.length).toBeGreaterThanOrEqual(2)
  return await Promise.all(all.filter(file => ownedDirectories.some(directory => file.startsWith(`${directory}${path.sep}`))).sort().map(async (file) => {
    const content = await readFile(file)
    return {
      file: path.relative(sourceRoot, file).replaceAll('\\', '/'),
      hash: createHash('sha256').update(content).digest('hex'),
      mtimeNs: (await stat(file, { bigint: true })).mtimeNs.toString(),
    }
  }))
}

export async function assertIssue1303ColdRuntime(project: string, value: number) {
  const session = createHeadlessSession({ projectPath: project })
  try {
    session.reLaunch(ISSUE_1303_ROUTE)
    expect(await session.evaluateRuntime<Promise<unknown>>('() => getCurrentPages()[0].runQuery()')).toEqual({ value, engine: ISSUE_1303_ENGINE })
    expect(session.renderCurrentPage().wxml).toContain(String(value))
  }
  finally {
    session.close()
  }
}

export async function exerciseIssue1303Watch(project: string, mode: Issue1303PackageMode, dev: ReturnType<typeof startIssueClassicDev>) {
  await dev.waitForInitialBuild()
  await waitForIssuePublication(project, dev)
  await assertIssue1303Artifacts(project, mode)
  await assertIssue1303ColdRuntime(project, 1303)
  const sources = await ownedSourceSnapshot(project)
  await assertClassicDevRemainsStable(dev, 120_000, async () => {
    expect(await ownedSourceSnapshot(project)).toEqual(sources)
    await assertIssue1303Artifacts(project, mode)
  })
  await replaceFileByRename(path.join(project, 'src/probe.ts'), 'export const queryValue = 1304\n')
  await dev.waitFor(waitForFileContains(path.join(project, 'dist/pages/index/index.js'), '1304'), 'SQLite consumer incremental rebuild')
  await waitForIssuePublication(project, dev)
  await assertIssue1303Artifacts(project, mode)
  expect(await ownedSourceSnapshot(project)).toEqual(sources)
  await assertIssue1303ColdRuntime(project, 1304)
}
