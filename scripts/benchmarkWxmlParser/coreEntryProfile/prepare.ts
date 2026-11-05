import type { Plugin } from 'esbuild'
import type { EntryArm, EntryFixture, EntrySteadyResult } from './types'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'
import { recordBuildInputs, recordFiles } from '../bundleIdentity'
import { hash, repositoryRoot } from '../freeze'

export interface PreparedEntryProfile {
  modules: Record<EntryArm, { node: string, browserCode: string, browserBytes: number, browserGzipBytes: number, browserSha256: string }>
  worker: string
  browserSteady: string
  browserRuntime: string
  runSteady: (fixtures: EntryFixture[], rounds: number, warmup: number) => EntrySteadyResult
  artifacts: Record<string, string>
}

/** 独立传输真实 built 根入口和 /core 闭包，模块、初始化与绑定后热路径分别报告。 */
export async function prepareEntryProfile(baselineEntry: string, rootEntry: string, coreEntry: string, output: string): Promise<PreparedEntryProfile> {
  const artifacts: Record<string, string> = {}
  const require = createRequire(path.join(repositoryRoot, 'packages/wxml/package.json'))
  const plugins: Plugin[] = [{ name: 'entry-profile-locked-entities', setup(builder) {
    builder.onResolve({ filter: /^entities(?:\/.*)?$/ }, args => ({ path: require.resolve(args.path) }))
  } }]
  const modules = {} as PreparedEntryProfile['modules']
  for (const [arm, entry] of Object.entries({ baseline: baselineEntry, root: rootEntry, core: coreEntry }) as Array<[EntryArm, string]>) {
    await readFile(entry)
    const contents = `export * from ${JSON.stringify(entry)}`
    const nodeFile = path.join(output, `entry-${arm}.mjs`)
    const browserFile = path.join(output, `entry-${arm}.js`)
    for (const platform of ['node', 'browser'] as const) {
      const result = await build({ absWorkingDir: repositoryRoot, stdin: { contents, resolveDir: repositoryRoot }, outfile: platform === 'node' ? nodeFile : browserFile, bundle: true, platform, format: platform === 'node' ? 'esm' : 'iife', globalName: platform === 'browser' ? 'EntryProfileProduct' : undefined, minify: platform === 'browser', metafile: true, logLevel: 'silent', plugins })
      await recordBuildInputs(result.metafile!, artifacts)
    }
    const bytes = await readFile(browserFile)
    modules[arm] = { node: nodeFile, browserCode: bytes.toString('utf8'), browserBytes: bytes.length, browserGzipBytes: gzipSync(bytes).length, browserSha256: hash(bytes) }
    await recordFiles([entry, nodeFile, browserFile], artifacts)
  }
  const steadyEntry = path.join(repositoryRoot, 'scripts/benchmarkWxmlParser/coreEntryProfile/steady.ts')
  const contents = `import * as root from ${JSON.stringify(rootEntry)};import * as core from ${JSON.stringify(coreEntry)};import {measureEntrySteady} from ${JSON.stringify(steadyEntry)};export const runSteady=(fixtures,rounds,warmup)=>measureEntrySteady(root,core,fixtures,rounds,warmup);`
  const nodeSteady = path.join(output, 'entry-steady.mjs')
  const browserSteady = path.join(output, 'entry-steady.js')
  const browserRuntime = path.join(output, 'entry-runtime.js')
  const worker = path.join(output, 'entry-worker.mjs')
  for (const [outfile, entryPoints, stdin, platform, globalName] of [
    [nodeSteady, undefined, { contents, resolveDir: repositoryRoot }, 'node', undefined],
    [browserSteady, undefined, { contents, resolveDir: repositoryRoot }, 'browser', 'EntryProfileSteady'],
    [browserRuntime, [steadyEntry], undefined, 'browser', 'EntryProfileRuntime'],
    [worker, [path.join(repositoryRoot, 'scripts/benchmarkWxmlParser/coreEntryProfile/worker.ts')], undefined, 'node', undefined],
  ] as const) {
    const result = await build({ absWorkingDir: repositoryRoot, entryPoints: entryPoints ? [...entryPoints] : undefined, stdin, outfile, bundle: true, platform, format: platform === 'node' ? 'esm' : 'iife', globalName, metafile: true, logLevel: 'silent', plugins })
    await recordBuildInputs(result.metafile!, artifacts)
    await recordFiles([outfile], artifacts)
  }
  const module = await import(pathToFileURL(nodeSteady).href) as { runSteady: PreparedEntryProfile['runSteady'] }
  return { modules, worker, browserSteady: await readFile(browserSteady, 'utf8'), browserRuntime: await readFile(browserRuntime, 'utf8'), runSteady: module.runSteady, artifacts }
}
