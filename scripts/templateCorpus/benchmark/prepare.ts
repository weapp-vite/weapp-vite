import type { ProfileDependencies, ProfileFixture, ProfileGroup, ProfileMeasurement, ProfileOptions } from './types'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'
import { recordBuildInputs, recordFiles } from '../../benchmarkWxmlParser/bundleIdentity'
import { corpusHash } from '../integrity'
import { repositoryRoot } from '../paths'

export interface PreparedProfile {
  run: (fixtures: ProfileFixture[], groups: ProfileGroup[], options: ProfileOptions) => ProfileMeasurement
  browserCode?: string
  artifacts: Record<string, string>
  versions: Record<string, string>
  moduleLoadMs: number
  bundle: { candidateBytes: number, candidateGzipBytes: number, baselineBytes: number, baselineGzipBytes: number }
}

async function packageVersion(entry: string, name: string): Promise<string> {
  for (let directory = path.dirname(entry); ;) {
    try {
      const parsed: unknown = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
      if (parsed && typeof parsed === 'object' && 'name' in parsed && parsed.name === name && 'version' in parsed && typeof parsed.version === 'string') {
        return parsed.version
      }
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
    const parent = path.dirname(directory)
    if (parent === directory) {
      throw new Error(`Cannot identify profile dependency: ${name}`)
    }
    directory = parent
  }
}

/** 打包仅准备相同 built 入口的测试宿主，全部发生在正式采样之前。 */
export async function prepareProfile(entry: string, output: string, browser: boolean): Promise<PreparedProfile> {
  const require = createRequire(path.join(repositoryRoot, 'packages/wxml/package.json'))
  const htmlEntry = require.resolve('htmlparser2')
  const serializerEntry = require.resolve('dom-serializer')
  const measureEntry = path.join(repositoryRoot, 'scripts/templateCorpus/benchmark/measure.ts')
  const contents = `import * as api from ${JSON.stringify(entry)};
import * as html from ${JSON.stringify(htmlEntry)};
import render from ${JSON.stringify(serializerEntry)};
import { measureProfile } from ${JSON.stringify(measureEntry)};
export const run = (fixtures, groups, options) => measureProfile({api,html,render}, fixtures, groups, options);
`
  const artifacts: Record<string, string> = {}
  await recordFiles([entry, htmlEntry, serializerEntry, path.join(repositoryRoot, 'pnpm-lock.yaml')], artifacts)
  const nodeFile = path.join(output, 'profile-runtime.mjs')
  const node = await build({ absWorkingDir: repositoryRoot, stdin: { contents, resolveDir: repositoryRoot }, outfile: nodeFile, bundle: true, platform: 'node', format: 'esm', metafile: true, logLevel: 'silent' })
  await recordBuildInputs(node.metafile!, artifacts)
  let browserCode: string | undefined
  if (browser) {
    const browserFile = path.join(output, 'profile-browser.js')
    const built = await build({ absWorkingDir: repositoryRoot, stdin: { contents, resolveDir: repositoryRoot }, outfile: browserFile, bundle: true, platform: 'browser', format: 'iife', globalName: 'TemplateCorpusProfile', minify: true, metafile: true, logLevel: 'silent' })
    await recordBuildInputs(built.metafile!, artifacts)
    browserCode = await readFile(browserFile, 'utf8')
    await recordFiles([browserFile], artifacts)
  }
  const bundles = []
  for (const contents of [`export * from ${JSON.stringify(entry)}`, `export * from ${JSON.stringify(htmlEntry)};export { default as serialize } from ${JSON.stringify(serializerEntry)}`]) {
    const built = await build({ absWorkingDir: repositoryRoot, stdin: { contents, resolveDir: repositoryRoot }, write: false, bundle: true, minify: true, platform: 'browser', format: 'esm', logLevel: 'silent' })
    const bytes = built.outputFiles[0]!.contents
    bundles.push({ bytes: bytes.length, gzip: gzipSync(bytes).length })
  }
  await recordFiles([nodeFile], artifacts)
  const versions = { 'htmlparser2': await packageVersion(htmlEntry, 'htmlparser2'), 'dom-serializer': await packageVersion(serializerEntry, 'dom-serializer') }
  const started = performance.now()
  const module = await import(pathToFileURL(nodeFile).href) as { run: PreparedProfile['run'] }
  const moduleLoadMs = performance.now() - started
  return { run: module.run, browserCode, moduleLoadMs, artifacts, versions, bundle: { candidateBytes: bundles[0]!.bytes, candidateGzipBytes: bundles[0]!.gzip, baselineBytes: bundles[1]!.bytes, baselineGzipBytes: bundles[1]!.gzip } }
}

/** 采样结束重新读取所有实际打包输入，拒绝源码、产物或锁文件期间漂移。 */
export async function assertProfileArtifacts(artifacts: Readonly<Record<string, string>>): Promise<void> {
  for (const [file, expected] of Object.entries(artifacts)) {
    if (corpusHash(await readFile(path.resolve(repositoryRoot, file))) !== expected) {
      throw new Error(`Performance profile artifact changed during measurement: ${file}`)
    }
  }
}

export type { ProfileDependencies }
