import { readFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const request = JSON.parse(await readFile(process.argv[2], 'utf8'))
let fixtureId = '<import>'
try {
  const importStarted = performance.now()
  const api = await import(pathToFileURL(request.entry).href)
  const importMs = performance.now() - importStarted
  const memoryBefore = process.memoryUsage()
  let sink
  const started = performance.now()
  for (const fixture of request.fixtures) {
    fixtureId = fixture.id
    sink = request.arm === 'candidate'
      ? api.parse(fixture.source, { syntax: 'xml', platform: fixture.platform })
      : api.parseDocument(fixture.source, request.baselineParseOptions)
  }
  const durationMs = performance.now() - started
  Reflect.set(globalThis, '__wxmlColdBenchmarkSink', sink)
  process.stdout.write(JSON.stringify({
    durationMs,
    importMs,
    memoryBefore,
    memoryAfter: process.memoryUsage(),
    peakRssBytes: process.resourceUsage().maxRSS * 1024,
    execArgv: process.execArgv,
  }))
}
catch (error) {
  process.stdout.write(JSON.stringify({ error: String(error), fixture: fixtureId, execArgv: process.execArgv }))
}
