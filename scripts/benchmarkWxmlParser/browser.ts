import type { BrowserContext } from 'playwright'
import type { ClockInformation } from './clock'
import type { Arm, Fixture, MeasurementError, MeasurementResult, Operation, Sample } from './types'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { installBenchmarkDocument, loadBenchmarkDocument } from './browserDocument'
import { cohorts, summarize } from './measurement'
import { CHROMIUM_ARGUMENTS, STACK_SIZE_KB } from './runtime'

async function browserCold(context: BrowserContext, code: string, fixtures: Fixture[], quick: boolean) {
  const samples: Array<Sample & { clock: ClockInformation, document: Awaited<ReturnType<typeof loadBenchmarkDocument>> }> = []
  const summaries: ReturnType<typeof summarize>[] = []
  const errors: MeasurementError[] = []
  const rounds = quick ? 1 : 40
  const operation: Operation = { id: 'browser-first-parse', comparable: false, run: () => undefined }
  for (const [cohort, files] of cohorts(fixtures)) {
    const collect = async (phase: Sample['phase']) => {
      for (let round = 0; round < rounds; round++) {
        const order: Arm[] = round % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']
        for (const arm of order) {
          let page: Awaited<ReturnType<BrowserContext['newPage']>> | undefined
          try {
            page = await context.newPage()
            const document = await loadBenchmarkDocument(page, 'cold')
            await page.addScriptTag({ content: code })
            const { durationMs, clock } = await page.evaluate(({ files, arm }) => {
              const api = Reflect.get(globalThis, 'WxmlBenchmark') as { firstParse: (files: unknown[], arm: string) => number, probeClock: () => ClockInformation }
              const clock = api.probeClock()
              return { durationMs: api.firstParse(files, arm), clock }
            }, { files, arm })
            samples.push({ operation: operation.id, cohort, round, arm, phase, durationMs, iterations: 1, documents: files.length, bytes: files.reduce((total, file) => total + file.bytes, 0), clock, document })
          }
          catch (error) {
            errors.push({ operation: operation.id, fixture: '<corpus>', cohort, arm, phase, round, error: String(error) })
            return false
          }
          finally {
            await page?.close()
          }
        }
      }
      return true
    }
    const complete = await collect('primary')
    if (complete && summarize(samples, operation, cohort, rounds).status === 'incomplete') {
      await collect('confirmation')
    }
    summaries.push(summarize(samples, operation, cohort, rounds))
  }
  return { samples, summaries, errors, parity: [], boundary: 'Fresh page per arm/cell; both libraries loaded but neither parser invoked before the first corpus pass. Module transport time excluded; OS cache retained.' }
}

export async function runBrowser(
  bundle: string,
  fixtures: Fixture[],
  quick: boolean,
  checkpoint: (result: unknown) => Promise<void>,
  expectedOperations: readonly string[],
) {
  const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGUMENTS })
  try {
    const session = await browser.newBrowserCDPSession()
    let commandLine: string[]
    try {
      commandLine = (await session.send('Browser.getBrowserCommandLine')).arguments
      if (!CHROMIUM_ARGUMENTS.every(argument => commandLine.includes(argument))) {
        throw new Error('Chromium did not receive the fixed V8 stack budget.')
      }
    }
    finally {
      await session.detach()
    }
    const context = await browser.newContext()
    try {
      await installBenchmarkDocument(context)
      const page = await context.newPage()
      const document = await loadBenchmarkDocument(page, 'warm')
      const started = performance.now()
      const code = await readFile(bundle, 'utf8')
      await page.addScriptTag({ content: code })
      const importMs = performance.now() - started
      const result = await page.evaluate(async ({ fixtures, quick, expectedOperations }) => {
        const api = Reflect.get(globalThis, 'WxmlBenchmark') as {
          operations: (input: unknown[]) => unknown[]
          measure: (operations: unknown[], input: unknown[], quick: boolean, checkpoint: undefined, expectedOperations: readonly string[]) => Promise<MeasurementResult>
        }
        return api.measure(api.operations(fixtures), fixtures, quick, undefined, expectedOperations)
      }, { fixtures, quick, expectedOperations })
      await page.close()
      const cold = await browserCold(context, code, fixtures, quick)
      const report = {
        version: browser.version(),
        headless: true,
        runtime: { stackSizeKb: STACK_SIZE_KB, args: CHROMIUM_ARGUMENTS, commandLine },
        document,
        importMs,
        result,
        cold,
        boundary: 'Chromium page-local warm batches include the same requested core and consumer operations as Node; no Playwright RPC inside timed operations. Scanner uses the documented real Babel module transport. Cold cells remain core first-parse only. Script injection includes IPC and is informational. Browser heap measurement unavailable.',
        memory: null,
      }
      await checkpoint(report)
      return report
    }
    finally {
      await context.close()
    }
  }
  finally {
    await browser.close()
  }
}
