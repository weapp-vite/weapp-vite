import type { probeClock } from '../clock'
import type { bindCoreParsers, bindRootParsers } from './binding'
import type { PreparedEntryProfile } from './prepare'
import type { CoreEntryApi, EntryFixture, EntryProfileSample, EntrySteadyResult, RootEntryApi } from './types'
import { chromium } from 'playwright'
import { installBenchmarkDocument, loadBenchmarkDocument } from '../browserDocument'
import { repositoryRoot } from '../freeze'
import { CHROMIUM_ARGUMENTS, STACK_SIZE_KB } from '../runtime'

interface BrowserRuntime {
  bindCoreParsers: typeof bindCoreParsers
  bindRootParsers: typeof bindRootParsers
  probeClock: typeof probeClock
}

/** 每侧首次 scan/parse 独占新页面，内存快照通过 CDP 在计时外读取。 */
export async function profileEntryChromium(prepared: PreparedEntryProfile, fixtures: EntryFixture[], rounds: number, warmup: number, checkpoint: (partial: unknown) => Promise<void> = async () => {}) {
  const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGUMENTS })
  try {
    const session = await browser.newBrowserCDPSession()
    const commandLine = (await session.send('Browser.getBrowserCommandLine')).arguments
    await session.detach()
    if (!CHROMIUM_ARGUMENTS.every(argument => commandLine.includes(argument)) || !commandLine.some(argument => argument === '--headless' || argument.startsWith('--headless='))) {
      throw new Error('Core entry profile could not confirm headless Chromium and the fixed stack budget')
    }
    const context = await browser.newContext()
    try {
      await installBenchmarkDocument(context)
      const samples: EntryProfileSample[] = []
      const errors: Array<{ arm: string, operation: string, round: number, error: string }> = []
      for (let round = 0; round < rounds; round++) {
        for (const operation of ['scan', 'parse'] as const) {
          for (const arm of round % 2 ? ['core', 'root', 'baseline'] as const : ['baseline', 'root', 'core'] as const) {
            const page = await context.newPage()
            const cdp = await context.newCDPSession(page)
            try {
              const document = await loadBenchmarkDocument(page, 'cold')
              await page.addScriptTag({ content: prepared.browserRuntime })
              await page.evaluate(fixtures => Reflect.set(globalThis, '__entryFixtures', fixtures), fixtures)
              const memory = async () => {
                const heap = await cdp.send('Runtime.getHeapUsage')
                return { usedSize: heap.usedSize, totalSize: heap.totalSize }
              }
              const beforeImport = await memory()
              const started = performance.now()
              await page.addScriptTag({ content: `Reflect.set(globalThis,'__entryModuleStart',performance.now());\n${prepared.modules[arm].browserCode}\nReflect.set(globalThis,'__entryModuleMs',performance.now()-Reflect.get(globalThis,'__entryModuleStart'));` })
              const injectionMs = performance.now() - started
              const afterImport = await memory()
              const initialization = await page.evaluate((arm) => {
                const runtime = Reflect.get(globalThis, 'EntryProfileRuntime') as BrowserRuntime
                const api = Reflect.get(globalThis, 'EntryProfileProduct') as CoreEntryApi & RootEntryApi
                const fixtures = Reflect.get(globalThis, '__entryFixtures') as EntryFixture[]
                const started = performance.now()
                const parsers = arm === 'core' ? runtime.bindCoreParsers(api, fixtures) : runtime.bindRootParsers(api, fixtures)
                const initializationMs = performance.now() - started
                Reflect.set(globalThis, '__entryParsers', parsers)
                return { initializationMs, parsers: parsers.size, moduleMs: Reflect.get(globalThis, '__entryModuleMs') as number }
              }, arm)
              const afterInitialization = await memory()
              const first = await page.evaluate((operation) => {
                const runtime = Reflect.get(globalThis, 'EntryProfileRuntime') as BrowserRuntime
                const fixtures = Reflect.get(globalThis, '__entryFixtures') as EntryFixture[]
                const parsers = Reflect.get(globalThis, '__entryParsers') as ReturnType<typeof bindCoreParsers>
                let sink: unknown
                const started = performance.now()
                for (const fixture of fixtures) {
                  sink = parsers.get(fixture.profileId)![operation](fixture.source)
                }
                const firstCallMs = performance.now() - started
                Reflect.set(globalThis, '__entryFirstCallSink', sink)
                return { firstCallMs, clock: runtime.probeClock() }
              }, operation)
              const afterFirstCall = await memory()
              if (!document.crossOriginIsolated) {
                throw new Error('Core entry first-call page is not cross-origin isolated')
              }
              samples.push({ arm, round, operation, ...initialization, initializationKind: arm === 'core' ? 'compile-dialect-and-create-parser' : 'benchmark-adapter-binding', ...first, injectionMs, documents: fixtures.length, bytes: fixtures.reduce((sum, fixture) => sum + fixture.bytes, 0), memory: { beforeImport, afterImport, afterInitialization, afterFirstCall, peakRssBytes: null } })
            }
            catch (error) {
              errors.push({ arm, operation, round, error: String(error).replaceAll(repositoryRoot, '<repository>') })
            }
            finally {
              try {
                await cdp.detach()
              }
              finally {
                await page.close()
              }
            }
          }
        }
        await checkpoint({ samples, errors })
      }
      const page = await context.newPage()
      try {
        await loadBenchmarkDocument(page, 'warm')
        await page.addScriptTag({ content: prepared.browserSteady })
        const steady = await page.evaluate(({ fixtures, rounds, warmup }) => {
          const runtime = Reflect.get(globalThis, 'EntryProfileSteady') as { runSteady: PreparedEntryProfile['runSteady'] }
          return runtime.runSteady(fixtures, rounds, warmup)
        }, { fixtures, rounds, warmup }) as EntrySteadyResult
        return { samples, errors, steady, runtime: { version: browser.version(), headless: true, commandLine, stackSizeKb: STACK_SIZE_KB }, boundary: 'Fresh isolated page per arm, operation and round. Module evaluation excludes JavaScript source parsing; injectionMs separately includes parsing, compilation and IPC. Initialization and the first full corpus pass are measured inside the page. Only core initialization compiles dialects and creates parsers; baseline/root initialization binds benchmark adapters, while their real preset work remains in module evaluation or first calls. CDP heap snapshots are outside timing and do not measure retained allocations. No forced GC or OS cache clearing.' }
      }
      finally {
        await page.close()
      }
    }
    finally {
      await context.close()
    }
  }
  finally {
    await browser.close()
  }
}
