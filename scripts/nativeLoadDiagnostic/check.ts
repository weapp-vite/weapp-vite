import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
// eslint-disable-next-line e18e/ban-dependencies -- 用当前 Node 与独立参数启动有界进程，兼容 Windows。
import { execa } from 'execa'
import { sanitizeScriptDiagnostic } from '../scriptAnalysisBaseline/diagnostics'
import { digest, repository, sourceIdentity } from './identity'
import { createNativeLoadDiagnostic } from './observation'
import { MODES, validateLoadTrace } from './validate'

/** 用实际 AST 入口核对四种加载路径；不测构建或 HMR，也不输出性能结论。 */
async function main() {
  const args = new Map<string, string>()
  for (const value of process.argv.slice(2)) {
    const match = /^--(binding|output)=(.+)$/.exec(value)
    if (!match || args.has(match[1]!)) {
      throw new Error('Expected --output=<new directory> [--binding=<release .node>]')
    }
    args.set(match[1]!, match[2]!)
  }
  if (!args.has('output')) {
    throw new Error('Output is required')
  }
  const binaries = args.has('binding') ? [] : (await readdir(path.join(repository, 'packages/ast-native'))).filter(file => file.endsWith('.node'))
  if (!args.has('binding') && binaries.length !== 1) {
    throw new Error('Build one native binding first, or pass --binding explicitly')
  }
  const nativePath = path.resolve(args.get('binding') ?? path.join(repository, 'packages/ast-native', binaries[0]!))
  const output = path.resolve(args.get('output')!)
  if (!nativePath.endsWith('.node')) {
    throw new Error('This source probe requires a direct native binary')
  }
  const bindingSha256 = digest(await readFile(nativePath))
  const sourceHashes = await sourceIdentity()
  await mkdir(path.dirname(output), { recursive: true })
  await mkdir(output)
  const runs: unknown[] = []
  let baseline: unknown
  let failure: string | undefined
  let active = ''
  const scrub = (value: unknown) => sanitizeScriptDiagnostic(value, [output, repository, process.cwd(), os.homedir()])
  try {
    for (const mode of MODES) {
      active = mode
      const directory = path.join(output, mode)
      const observer = await createNativeLoadDiagnostic({ mode, directory, nativePath })
      const resultFile = path.join(directory, 'result.json')
      const child = await execa(process.execPath, ['--require', observer.preload, '--import', 'tsx', 'scripts/nativeLoadDiagnostic/worker.ts', `--output=${resultFile}`], {
        cwd: repository,
        env: { ...observer.environment, NODE_OPTIONS: '' },
        timeout: 60_000,
        reject: false,
      })
      await writeFile(path.join(directory, 'worker.log'), String(scrub(`${child.stdout}\n${child.stderr}`)), { flag: 'wx' })
      if (child.exitCode !== 0 || child.signal) {
        throw new Error(`${mode}: diagnostic worker did not finish successfully`)
      }
      const trace = await readFile(observer.trace, 'utf8')
      const observation = validateLoadTrace(trace, mode)
      const rawResult = await readFile(resultFile, 'utf8')
      const result: unknown = JSON.parse(rawResult)
      if (mode === 'off') {
        baseline = result
      }
      else if (!isDeepStrictEqual(result, baseline)) {
        await writeFile(path.join(directory, 'mismatch.json'), `${JSON.stringify(scrub({ baseline, actual: result }), null, 2)}\n`, { flag: 'wx' })
        throw new Error(`${mode}: public analysis outputs differ from JS baseline`)
      }
      runs.push({ ...observation, outputSha256: digest(rawResult), traceSha256: digest(trace), generatedHashes: {
        preload: digest(await readFile(observer.preload)),
        binding: digest(await readFile(observer.binding)),
      } })
    }
    if (!isDeepStrictEqual(sourceHashes, await sourceIdentity()) || bindingSha256 !== digest(await readFile(nativePath))) {
      throw new Error('Source or binary changed during the diagnostic')
    }
  }
  catch (error) {
    failure = String(scrub(error instanceof Error ? error.message : error))
  }
  const report = {
    schemaVersion: 1,
    passed: !failure,
    scope: 'Four-mode native lazy-load source probe, not build/HMR or performance acceptance',
    failedMode: failure ? active : undefined,
    failure,
    sourceHashes,
    bindingSha256,
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    runs,
    outputs: baseline,
    limitations: [
      'Analysis explicitly uses Oxc fallback for exact booleans; default Babel helpers can return conservative true without a parser.',
      'Explicit synthetic source calls exercise the production AST operations; no actual build, HMR or runtime is observed.',
      'Wrapper initialization observes only the first uncached require boundary, not enabled checks or every loader request.',
      'Observed fallback events do not count every JS fallback; legacy missing-method paths can return without an event.',
      'Cache hits refer to analysis results, not module or binding loader cache hits.',
      'Loader duration in private traces includes observer overhead and is not a performance sample.',
      'Source/configuration/lockfile hashes do not verify every installed dependency file.',
      'Binary identity is recorded; this tool does not establish which source revision built it.',
      'Raw traces, generated wrappers and owner records contain local identifiers and remain private.',
    ],
  }
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ passed: report.passed, failure, modes: runs.length }))
  if (failure) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
