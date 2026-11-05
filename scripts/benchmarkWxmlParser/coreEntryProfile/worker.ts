import type { CoreEntryApi, EntryArm, EntryFixture, RootEntryApi } from './types'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { probeClock } from '../clock'
import { bindCoreParsers, bindRootParsers } from './binding'

const request = JSON.parse(await readFile(process.argv[2]!, 'utf8')) as { entry: string, fixtures: EntryFixture[], arm: EntryArm, operation: 'scan' | 'parse' }
try {
  const beforeImport = process.memoryUsage()
  const started = performance.now()
  const api = await import(pathToFileURL(request.entry).href) as CoreEntryApi & RootEntryApi
  const moduleMs = performance.now() - started
  const afterImport = process.memoryUsage()
  const initializationStart = performance.now()
  const parsers = request.arm === 'core' ? bindCoreParsers(api, request.fixtures) : bindRootParsers(api, request.fixtures)
  const initializationMs = performance.now() - initializationStart
  const afterInitialization = process.memoryUsage()
  let sink: unknown
  const callStart = performance.now()
  for (const fixture of request.fixtures) {
    sink = parsers.get(fixture.profileId)![request.operation](fixture.source)
  }
  const firstCallMs = performance.now() - callStart
  Reflect.set(globalThis, '__coreEntryFirstCallSink', sink)
  process.stdout.write(JSON.stringify({ arm: request.arm, operation: request.operation, moduleMs, initializationMs, initializationKind: request.arm === 'core' ? 'compile-dialect-and-create-parser' : 'benchmark-adapter-binding', firstCallMs, documents: request.fixtures.length, bytes: request.fixtures.reduce((sum, fixture) => sum + fixture.bytes, 0), parsers: parsers.size, clock: probeClock(), memory: { beforeImport, afterImport, afterInitialization, afterFirstCall: process.memoryUsage(), peakRssBytes: process.resourceUsage().maxRSS * 1024 }, execArgv: process.execArgv }))
}
catch (error) {
  process.stdout.write(JSON.stringify({ error: String(error) }))
}
