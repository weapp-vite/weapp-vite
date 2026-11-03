import type { BaselineManifest, CorpusEntry } from './freeze'
import type { Fixture } from './types'
import { Buffer } from 'node:buffer'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'
import { browserConsumerTransport, browserTransportPlan } from './browserTransport'
import { recordBuildInputs, recordFiles } from './bundleIdentity'
import { CORE_OPERATIONS } from './contracts'
import { supplementFixtures } from './fixtures'
import { baselineRoot, consumerEntries, freezeBaseline, hash, readPolicy, repositoryRoot } from './freeze'

export interface Prepared {
  manifest: BaselineManifest
  fixtures: Fixture[]
  suite: string
  browserSuite?: string
  browserTransport?: { boundary: string, parser: string, aliases: Record<string, string> }
  artifacts: Record<string, string>
  bundle: { baselineBytes: number, candidateBytes: number, baselineGzip: number, candidateGzip: number }
  versions: Record<string, string>
  coldEntries: { baseline: string, candidate: string }
  expectedOperations: string[]
}

export function argumentsFor(argv: string[]) {
  const quick = argv.includes('--quick')
  const check = argv.includes('--check')
  if (quick === check) {
    throw new Error('Choose exactly one of --quick (exploratory) or --check (formal).')
  }
  const at = argv.indexOf('--output')
  const consumers: Record<string, string> = {}
  for (const name of Object.keys(consumerEntries)) {
    const index = argv.indexOf(`--consumer-${name}`)
    if (index >= 0) {
      if (!argv[index + 1] || argv[index + 1]!.startsWith('--')) {
        throw new Error(`--consumer-${name} requires a built adapter entry or source entry to bundle.`)
      }
      consumers[name] = argv[index + 1]!
    }
  }
  if (at >= 0 && (!argv[at + 1] || argv[at + 1]!.startsWith('--'))) {
    throw new Error('--output requires a new directory.')
  }
  return { quick, check, browser: argv.includes('--browser'), output: at < 0 ? undefined : argv[at + 1], consumers }
}

export async function readCorpus(directory = baselineRoot): Promise<{ manifest: BaselineManifest, fixtures: Fixture[] }> {
  const policy = await readPolicy()
  let source: string
  try {
    source = await readFile(path.join(directory, 'manifest.json'), 'utf8')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
    await mkdir(path.dirname(directory), { recursive: true })
    await freezeBaseline(directory, policy.baselineRef)
    source = await readFile(path.join(directory, 'manifest.json'), 'utf8')
  }
  const manifest = JSON.parse(source) as BaselineManifest
  if (manifest.schemaVersion !== 1 || !manifest.files.length) {
    throw new Error('Invalid or missing immutable corpus manifest.')
  }
  if (manifest.commit !== policy.baselineRef || manifest.files.length !== policy.expectedDocuments || hash(JSON.stringify(manifest.files)) !== policy.corpusSha256) {
    throw new Error('Existing baseline differs from the reviewed policy; preserve it and choose a deliberate new baseline.')
  }
  const fixtures: Fixture[] = []
  for (const file of manifest.files) {
    const source = await readFile(path.join(directory, 'corpus', `${file.id}.txt`), 'utf8')
    if (hash(source) !== file.sha256 || Buffer.byteLength(source) !== file.bytes) {
      throw new Error(`Frozen corpus identity mismatch: ${file.id}`)
    }
    fixtures.push({ ...file, source })
  }
  for (const [file, expected] of Object.entries(manifest.artifacts)) {
    if (hash(await readFile(path.join(directory, file))) !== expected) {
      throw new Error(`Frozen consumer identity mismatch: ${file}`)
    }
  }
  return { manifest, fixtures }
}

async function sourceFiles(directory: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await sourceFiles(filename))
    }
    else if (entry.isFile()) {
      files.push(filename)
    }
  }
  return files.sort()
}

export async function prepare(output: string, browser: boolean, consumers: Record<string, string>): Promise<Prepared> {
  const require = createRequire(path.join(repositoryRoot, 'packages/wxml/package.json'))
  const html = require.resolve('htmlparser2')
  const serializer = require.resolve('dom-serializer')
  const candidate = path.join(repositoryRoot, 'packages/wxml/dist/index.mjs')
  await readFile(candidate)
  const artifacts: Record<string, string> = {}
  const sources = [
    ...await sourceFiles(path.join(repositoryRoot, 'packages/wxml/src')),
    ...await sourceFiles(path.join(repositoryRoot, 'scripts/benchmarkWxmlParser')),
    ...Object.values(consumers).map(entry => path.resolve(repositoryRoot, entry.split('#')[0]!)),
  ]
  for (const file of sources) {
    artifacts[path.relative(repositoryRoot, file).replaceAll('\\', '/')] = hash(await readFile(file))
  }
  const { manifest, fixtures: originals } = await readCorpus()
  await recordFiles([path.join(baselineRoot, 'manifest.json'), ...Object.keys(manifest.artifacts).map(file => path.join(baselineRoot, file))], artifacts)
  const fixtures = supplementFixtures(originals, await readPolicy())
  const expectedOperations = [...CORE_OPERATIONS, ...Object.keys(consumers).map(name => `consumer-${name}`)]
  const imports = [
    `import * as wxml from ${JSON.stringify(candidate)}`,
    `import * as html from ${JSON.stringify(html)}`,
    `import render from ${JSON.stringify(serializer)}`,
    `import {createOperations} from ${JSON.stringify(path.join(repositoryRoot, 'scripts/benchmarkWxmlParser/operations.ts'))}`,
    `import {firstParse as measureFirstParse} from ${JSON.stringify(path.join(repositoryRoot, 'scripts/benchmarkWxmlParser/parserContract.ts'))}`,
    `export {measure} from ${JSON.stringify(path.join(repositoryRoot, 'scripts/benchmarkWxmlParser/measurement.ts'))}`,
    `export {probeClock} from ${JSON.stringify(path.join(repositoryRoot, 'scripts/benchmarkWxmlParser/clock.ts'))}`,
    `export {checkCorrectness} from ${JSON.stringify(path.join(repositoryRoot, 'scripts/benchmarkWxmlParser/correctness.ts'))}`,
  ]
  const mappings: string[] = []
  for (const [name, entry] of Object.entries(consumers)) {
    const [file, exported] = entry.split('#')
    const symbol = exported ?? (name === 'simulator' ? 'parseWxsTemplateDocument' : 'parseWxml')
    const publicName = name === 'simulator' ? 'parseWxsTemplateDocument' : 'parseWxml'
    const built = path.join(output, `candidate-${name}.mjs`)
    const result = await build({
      absWorkingDir: repositoryRoot,
      entryPoints: [path.resolve(repositoryRoot, file!)],
      outfile: built,
      bundle: true,
      platform: 'node',
      format: 'esm',
      packages: 'external',
      metafile: true,
      logLevel: 'silent',
      plugins: [{ name: 'built-wxml', setup(builder) {
        builder.onResolve({ filter: /^@weapp-vite\/wxml$/ }, () => ({ path: candidate }))
      } }],
    })
    await recordBuildInputs(result.metafile!, artifacts)
    imports.push(`import {${symbol} as candidate_${name}} from ${JSON.stringify(built)}`)
    imports.push(`import {${publicName} as baseline_${name}} from ${JSON.stringify(path.join(baselineRoot, `${name}.mjs`))}`)
    mappings.push(`${JSON.stringify(name)}:{baseline:{${publicName}:baseline_${name}},candidate:{${publicName}:candidate_${name}}}`)
  }
  const source = [...imports, `export const operations = fixtures => createOperations({wxml,html,render,consumers:{${mappings.join(',')}}},fixtures)`, 'export const firstParse = (fixtures,arm) => measureFirstParse(fixtures,arm,wxml,html)'].join('\n')
  const suite = path.join(output, 'suite.mjs')
  const nodeBuild = await build({ absWorkingDir: repositoryRoot, stdin: { contents: source, resolveDir: repositoryRoot }, outfile: suite, bundle: true, platform: 'node', format: 'esm', packages: 'external', metafile: true, logLevel: 'silent' })
  await recordBuildInputs(nodeBuild.metafile!, artifacts)
  let browserSuite: string | undefined
  let browserTransport: Prepared['browserTransport']
  if (browser) {
    browserSuite = path.join(output, 'browser.js')
    const plan = browserTransportPlan(consumers.scanner ? path.join(output, 'candidate-scanner.mjs') : undefined)
    // 直接重放已冻结的 Node bundle，保留同一业务源码闭包和消费者映射。
    const browserBuild = await build({ absWorkingDir: repositoryRoot, stdin: { contents: source, resolveDir: repositoryRoot }, outfile: browserSuite, bundle: true, platform: 'browser', format: 'iife', globalName: 'WxmlBenchmark', minify: true, metafile: true, logLevel: 'silent', plugins: [browserConsumerTransport(plan)] })
    await recordBuildInputs(browserBuild.metafile!, artifacts)
    if (consumers.scanner) {
      await recordFiles([plan.astEntry, plan.astPackage, plan.compilerEntry, plan.compilerPackage], artifacts)
      browserTransport = {
        boundary: 'Scanner browser transport uses the actual locked Babel parser. The AST barrel parse export and compiler builtin exports resolve directly to their existing implementation files; only the Babel loader and frozen scanner may import the finite createRequire bridge. No business parser or component data is substituted; module import/lazy-load cost is outside warm timing.',
        parser: path.relative(repositoryRoot, plan.parser).replaceAll('\\', '/'),
        aliases: { '@weapp-vite/ast': path.relative(repositoryRoot, plan.babel).replaceAll('\\', '/'), 'node:module': path.relative(repositoryRoot, plan.bridge).replaceAll('\\', '/'), 'wevu/compiler': path.relative(repositoryRoot, plan.compilerBuiltin).replaceAll('\\', '/') },
      }
    }
  }
  const bundles: Uint8Array[] = []
  for (const [name, contents] of Object.entries({ baseline: `export * from ${JSON.stringify(html)};export {default as serialize} from ${JSON.stringify(serializer)}`, candidate: `export * from ${JSON.stringify(candidate)}` })) {
    const result = await build({ stdin: { contents, resolveDir: repositoryRoot }, bundle: true, platform: 'browser', format: 'esm', minify: true, write: false, logLevel: 'silent' })
    const bytes = result.outputFiles[0]!.contents
    bundles.push(bytes)
    artifacts[`${name}-browser-bundle`] = hash(bytes)
  }
  for (const file of [path.join(repositoryRoot, 'scripts/benchmarkWxmlParser/policy.json'), candidate, suite, ...(browserSuite ? [browserSuite] : []), ...Object.keys(consumers).map(name => path.join(output, `candidate-${name}.mjs`))]) {
    artifacts[path.relative(repositoryRoot, file).replaceAll('\\', '/')] = hash(await readFile(file))
  }
  const versions: Record<string, string> = {}
  for (const dependency of ['htmlparser2', 'dom-serializer', 'esbuild', 'playwright', ...(consumers.scanner ? ['@babel/parser'] : [])]) {
    let directory = path.dirname(dependency === '@babel/parser' ? browserTransportPlan().parser : require.resolve(dependency))
    for (;;) {
      try {
        const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')) as { name: string, version: string }
        if (pkg.name === dependency) {
          versions[dependency] = pkg.version
          await recordFiles([path.join(directory, 'package.json')], artifacts)
          break
        }
      }
      catch {}
      const parent = path.dirname(directory)
      if (parent === directory) {
        throw new Error(`Cannot identify ${dependency} version.`)
      }
      directory = parent
    }
  }
  const prepared = {
    manifest,
    fixtures,
    suite,
    browserSuite,
    browserTransport,
    artifacts,
    versions,
    coldEntries: { baseline: html, candidate },
    expectedOperations,
    bundle: { baselineBytes: bundles[0]!.length, candidateBytes: bundles[1]!.length, baselineGzip: gzipSync(bundles[0]!).length, candidateGzip: gzipSync(bundles[1]!).length },
  }
  await writeFile(path.join(output, 'inputs.json'), `${JSON.stringify({ ...prepared, fixtures: fixtures.map(({ source: _source, ...fixture }) => fixture) }, null, 2)}\n`)
  return prepared
}

export function corpusSummary(files: CorpusEntry[]) {
  return { documents: files.length, bytes: files.reduce((total, file) => total + file.bytes, 0), origins: files.reduce((total, file) => total + file.origins.length, 0) }
}
