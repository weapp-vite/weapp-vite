import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
// eslint-disable-next-line e18e/ban-dependencies -- 当前 Node 与参数数组跨平台启动独占的有界子进程。
import { execa } from 'execa'
import { serializeDiagnosticError } from '../optimizedCompilerAnalysis/diagnosticError'
import { analysisOptions } from '../optimizedCompilerAnalysis/options'
import { optimizedScenarios } from '../optimizedCompilerAnalysis/scenarios'
import { sanitizeScriptDiagnostic } from '../scriptAnalysisBaseline/diagnostics'
import { digest, repository, scriptTransformIdentity } from './identity'
import { loadScriptPrinter } from './native'
import { printerSummary, runPrinterChecks } from './printChecks'
import { STAGE_VARIANTS, verifyStageReport } from './stageChecks'

/** 默认兼容门禁严格失败；显式诊断模式仍保留 comparisonPassed=false，不宣称可接入生产。 */
async function main() {
  const arguments_ = process.argv.slice(2)
  const allowDifferences = arguments_.includes('--allow-differences')
  if (arguments_.filter(value => value === '--allow-differences').length > 1) {
    throw new Error('Repeated --allow-differences')
  }
  const { binding, output } = await analysisOptions(arguments_.filter(value => value !== '--allow-differences'))
  await mkdir(path.dirname(output), { recursive: true })
  await mkdir(output)
  const sourceHashes = await scriptTransformIdentity()
  const bindingSha256 = digest(await readFile(binding))
  const scenarios = await optimizedScenarios()
  const scrub = (value: unknown) => sanitizeScriptDiagnostic(value, [repository, output, path.dirname(binding)])
  const expected = new Map<string, string>()
  const workers: unknown[] = []
  let probe: ReturnType<typeof printerSummary> | undefined
  let failure: unknown
  let printerReportSha256: string | undefined
  try {
    for (const variant of STAGE_VARIANTS) {
      const directory = path.join(output, variant)
      const worker = await execa(process.execPath, ['--import', 'tsx', 'scripts/nativeScriptTransform/stageWorker.ts', variant, directory], {
        cwd: repository,
        env: { WEAPP_VITE_NATIVE: '0', NODE_OPTIONS: '' },
        timeout: 120_000,
        reject: false,
      })
      await writeFile(path.join(output, `${variant}.log`), String(scrub(`${worker.stdout}\n${worker.stderr}`)), { flag: 'wx' })
      if (worker.exitCode !== 0 || worker.signal) {
        throw new Error(`${variant}: stage worker failed; log and report are preserved`)
      }
      const raw = await readFile(path.join(directory, 'report.json'), 'utf8')
      const verified = verifyStageReport(JSON.parse(raw) as unknown, variant, sourceHashes, scenarios, expected)
      workers.push({ variant, reportSha256: digest(raw), checks: verified.checks, loader: verified.loader, records: verified.records.map(record => ({ scenarioId: record.scenarioId, callIndex: record.callIndex, sourceSha256: record.source.sha256, status: record.status, fastSetup: record.fastSetup, bridge: record.bridge, warningObservations: { handler: record.warnings.filter(warning => warning.channel === 'handler').length, console: record.warnings.filter(warning => warning.channel === 'console').length } })) })
      console.log(`[native-script-transform] ${variant}: ${verified.checks.length} complete checks; ${verified.records.length} stage records`)
      if (variant === 'captured-optimized-js') {
        const printer = await loadScriptPrinter(binding)
        if (printer.sha256 !== bindingSha256) {
          throw new Error('Experimental binding changed before loading')
        }
        const report = runPrinterChecks(printer, verified.records)
        const raw = `${JSON.stringify(report)}\n`
        printerReportSha256 = digest(raw)
        await writeFile(path.join(output, 'printer-report.json'), raw, { flag: 'wx' })
        probe = printerSummary(report)
      }
    }
  }
  catch (error) {
    failure = scrub(serializeDiagnosticError(error))
  }
  const sourcesUnchanged = isDeepStrictEqual(sourceHashes, await scriptTransformIdentity())
  const bindingUnchanged = bindingSha256 === digest(await readFile(binding))
  const completed = !failure && sourcesUnchanged && bindingUnchanged && workers.length === STAGE_VARIANTS.length && Boolean(probe?.observations.length)
  const comparisonPassed = completed && probe!.observations.every(observation => observation.comparisonPassed)
  const summary = { schemaVersion: 1, completed, comparisonPassed, allowDifferences, failure, sourceHashes, sourcesUnchanged, bindingSha256, bindingUnchanged, printerReportSha256, environment: { node: process.version, platform: process.platform, arch: process.arch }, workers, probe, scope: 'Experimental Oxc printer and real optimized-JS transformScript capture; no native Vue/Wevu rewrite, production integration or performance result.', limitations: [
    'Complete original/optimized/captured compiler outputs must match byte-for-byte; separate printer output intentionally remains outside the compiler.',
    'Capture describes every option and preserves actual AST transfer ownership; expression strings plus top-level spans do not establish cross-source token provenance.',
    'Printing already transformed JavaScript does not remove Babel parse/traverse/generate or prove compatibility of a future complete Rust transformScript.',
    'AST, comments and identifier map anchors are partial correctness evidence, not runtime E2E, breakpoint policy or every annotation attachment.',
    'Explicit allow-differences is diagnostic completion only; comparisonPassed remains false for any printer mismatch.',
    'Source hashes and binary identity do not prove the binary was built from those sources or identify every installed dependency file.',
  ] }
  await writeFile(path.join(output, 'summary.json'), `${JSON.stringify(scrub(summary), null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ completed, comparisonPassed, workers: workers.length, observations: probe?.observations.length, failure }))
  if (!completed || (!comparisonPassed && !allowDifferences)) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
