import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
// eslint-disable-next-line e18e/ban-dependencies -- 当前 Node 与参数数组跨平台启动独占的有界子进程。
import { execa } from 'execa'
import { sanitizeScriptDiagnostic } from '../scriptAnalysisBaseline/diagnostics'
import { OPTIMIZED_COMPILER_VARIANTS } from './execution'
import { digest, optimizedSourceIdentity, repository } from './identity'
import { analysisOptions } from './options'
import { optimizedScenarios } from './scenarios'
import { verifyOptimizedCheck, verifyScriptCoverage, verifyStartup } from './verify'

/** 原始编译器、双 loader 控制及三种组合方案串行比较，保留每次完整返回值。 */
async function main() {
  const { binding, output } = await analysisOptions(process.argv.slice(2))
  const sourceHashes = await optimizedSourceIdentity()
  const bindingSha256 = digest(await readFile(binding))
  const scenarios = await optimizedScenarios()
  await mkdir(path.dirname(output), { recursive: true })
  await mkdir(output)
  const runs: unknown[] = []
  const expected = new Map<string, string>()
  let failure: string | undefined
  const scrub = (value: unknown) => sanitizeScriptDiagnostic(value, [repository, output, path.dirname(binding)])
  try {
    for (const variant of OPTIMIZED_COMPILER_VARIANTS) {
      const directory = path.join(output, variant)
      const child = await execa(process.execPath, ['--import', 'tsx', 'scripts/optimizedCompilerAnalysis/worker.ts', variant, binding, directory], {
        cwd: repository,
        env: { WEAPP_VITE_NATIVE: '0', NODE_OPTIONS: '' },
        timeout: 120_000,
        reject: false,
      })
      await writeFile(path.join(output, `${variant}.log`), String(scrub(`${child.stdout}\n${child.stderr}`)), { flag: 'wx' })
      if (child.exitCode !== 0 || child.signal) {
        throw new Error(`${variant}: correctness worker failed; its report and log are preserved`)
      }
      const raw = await readFile(path.join(directory, 'report.json'), 'utf8')
      const report = verifyStartup(JSON.parse(raw) as unknown, variant, sourceHashes, bindingSha256)
      if (!Array.isArray(report.checks) || report.checks.length !== scenarios.length * 2) {
        throw new Error(`${variant}: incomplete correctness matrix`)
      }
      const checks = report.checks.map((value, index) => verifyOptimizedCheck(value, scenarios[Math.floor(index / 2)]!, variant, index % 2))
      for (const check of checks) {
        const reference = expected.get(check.scenario)
        if (reference === undefined) {
          if (variant !== 'baseline') {
            throw new Error('Original compiler must establish the correctness oracle')
          }
          expected.set(check.scenario, check.output)
        }
        else if (reference !== check.output) {
          await writeFile(path.join(output, `${variant}-${check.scenario}-mismatch.json`), `${JSON.stringify(scrub({ expected: reference, actual: check.output }), null, 2)}\n`, { flag: 'wx' })
          throw new Error(`${variant}/${check.scenario}: full output, maps, warnings or diagnostics differ`)
        }
      }
      verifyScriptCoverage(checks, variant)
      runs.push({ variant, reportSha256: digest(raw), hookSources: report.hookSources, checks: checks.map(({ output, ...check }) => ({ ...check, outputSha256: digest(output) })) })
      console.log(`[optimized-compiler] ${variant}: ${checks.length} complete checks`)
    }
  }
  catch (error) {
    failure = String(scrub(error instanceof Error ? error.message : String(error)))
  }
  const sourcesUnchanged = isDeepStrictEqual(sourceHashes, await optimizedSourceIdentity())
  const bindingUnchanged = bindingSha256 === digest(await readFile(binding))
  const report = {
    schemaVersion: 1,
    passed: !failure && sourcesUnchanged && bindingUnchanged && runs.length === OPTIMIZED_COMPILER_VARIANTS.length,
    failure,
    sourceHashes,
    sourcesUnchanged,
    bindingSha256,
    bindingUnchanged,
    scope: 'Correctness of optimized script JS composed with existing batch binding JS/Rust; no timing or production changes.',
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    scenarios: scenarios.map(entry => ({ id: entry.scenario.id, inputSha256: digest(JSON.stringify(entry.scenario)), nativeFault: entry.nativeFault, bindingCoverage: entry.bindingCoverage })),
    runs,
    limitations: [
      'Five fresh processes execute serially; every complete output compares with the first original compiler result, including repeated calls.',
      'Only the optimized-native variant loads the explicitly provided experimental addon; production native remains disabled.',
      'This establishes composition correctness and coverage, not added Rust speedup on the stronger JS baseline.',
      'Source hashes and binary identity do not prove every installed dependency file or the source revision used to build the binary.',
      'Full private worker records preserve original outputs; mismatch copies and logs are sanitized separately without altering comparison hashes.',
    ],
  }
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ passed: report.passed, scenarios: scenarios.length, variants: runs.length, failure }))
  if (!report.passed) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
