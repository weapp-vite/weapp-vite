import type { Cell, Measurement, ProfileCase } from './types'
import { readFile, writeFile } from 'node:fs/promises'
import { Session } from 'node:inspector/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { deserialize, serialize } from 'node:v8'
import { installDiagnostics } from './diagnostics'
import { measureRealEntry } from './entry'
import { hashFile } from './identity'

interface Request { root: string, addon: string, fixture: ProfileCase, cell: Cell, output: string, diagnosticProxy: string }
interface AllocationNode { selfSize: number, children: AllocationNode[] }

export async function runWorker(request: Request): Promise<Measurement> {
  const { root, cell, fixture, addon } = request
  delete process.env.WEAPP_VITE_NATIVE
  delete process.env.WEAPP_VITE_NATIVE_AST_PATH
  delete process.env.NAPI_RS_NATIVE_LIBRARY_PATH
  let binding: Record<string, unknown> | undefined
  let addonLoadMs = 0
  if (cell.arm === 'on') {
    const addonStarted = performance.now()
    binding = createRequire(import.meta.url)(addon) as Record<string, unknown>
    addonLoadMs = performance.now() - addonStarted
    if (typeof binding.analyzeCompilerScriptsNative !== 'function') {
      throw new TypeError('Loaded native addon lacks analyzeCompilerScriptsNative.')
    }
  }
  const diagnostic = cell.metric === 'diagnostic' ? installDiagnostics(binding) : undefined
  const inspector = cell.metric === 'diagnostic' ? new Session() : undefined
  try {
    if (cell.arm === 'on') {
      process.env.WEAPP_VITE_NATIVE = '1'
      if (diagnostic) {
        Reflect.set(globalThis, '__weappCompilerProfileBinding', diagnostic.nativeProxy)
        await writeFile(request.diagnosticProxy, 'module.exports = globalThis.__weappCompilerProfileBinding\n')
      }
      process.env.WEAPP_VITE_NATIVE_AST_PATH = diagnostic ? request.diagnosticProxy : addon
    }
    const compilerEntry = path.join(root, 'packages-runtime/wevu-compiler/dist/index.mjs')
    const filename = path.join(root, fixture.project, fixture.file)
    const source = await readFile(filename, 'utf8')
    const identity = { compilerSha256: await hashFile(compilerEntry), addonSha256: cell.arm === 'on' ? await hashFile(addon) : null, sourceSha256: await hashFile(filename) }
    const importStarted = performance.now()
    const compiler = await import(pathToFileURL(compilerEntry).href) as typeof import('../../packages-runtime/wevu-compiler/src/index')
    const importMs = performance.now() - importStarted
    if (typeof compiler.compileVueFile !== 'function') {
      throw new TypeError('Built public compiler entry lacks compileVueFile.')
    }
    const preparationStarted = performance.now()
    const { createRealCompileOptions } = await import('./options')
    const { options, manifestOptions } = await createRealCompileOptions(root, fixture, cell.sourceMap)
    const preparationMs = performance.now() - preparationStarted
    const warmupCount = cell.condition === 'warm' ? 2 : 0
    for (let index = 0; index < warmupCount; index++) {
      const warmup = await measureRealEntry(compiler.compileVueFile, source, filename, options)
      if (warmup.outcome.status !== 'success') {
        throw new Error('Real compiler warmup failed.')
      }
    }
    if (diagnostic) {
      const gc = Reflect.get(globalThis, 'gc') as (() => void) | undefined
      if (!gc) {
        throw new Error('Diagnostic pass requires --expose-gc.')
      }
      gc()
      diagnostic.reset()
      inspector!.connect()
      await inspector!.post('HeapProfiler.startSampling', {
        samplingInterval: 16384,
        includeObjectsCollectedByMajorGC: true,
        includeObjectsCollectedByMinorGC: true,
      })
    }
    const before = process.memoryUsage()
    const cpuStarted = diagnostic ? process.cpuUsage() : undefined
    const measured = await measureRealEntry(compiler.compileVueFile, source, filename, options)
    const cpu = cpuStarted ? process.cpuUsage(cpuStarted) : null
    const after = process.memoryUsage()
    let sampledAllocationBytes: number | null = null
    if (diagnostic) {
      const { profile } = await inspector!.post('HeapProfiler.stopSampling')
      const total = (node: AllocationNode): number => node.selfSize + node.children.reduce((sum, child) => sum + total(child), 0)
      sampledAllocationBytes = total(profile.head)
      await diagnostic.finish(measured.startedAt, measured.endedAt)
    }
    if (identity.compilerSha256 !== await hashFile(compilerEntry)
      || identity.sourceSha256 !== await hashFile(filename)
      || (cell.arm === 'on' && identity.addonSha256 !== await hashFile(addon))) {
      throw new Error('Worker input identity drifted during compilation.')
    }
    return {
      cell,
      compileMs: measured.compileMs,
      outcome: measured.outcome,
      addonLoadMs,
      importMs,
      preparationMs,
      optionsSummary: JSON.parse(JSON.stringify(manifestOptions, (_key, value: unknown) => typeof value === 'function' ? '<function>' : value)) as Record<string, unknown>,
      identity,
      warmupCount,
      rssBefore: before.rss,
      rssAfter: after.rss,
      peakRssBytes: process.resourceUsage().maxRSS * 1024,
      counters: diagnostic?.counters ?? null,
      gc: diagnostic?.gc ?? null,
      cpu,
      sampledAllocationBytes,
    }
  }
  finally {
    inspector?.disconnect()
    diagnostic?.close()
    Reflect.deleteProperty(globalThis, '__weappCompilerProfileBinding')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void (async () => {
    const request = deserialize(await readFile(process.argv[2]!)) as Request
    const measurement = await runWorker(request)
    await writeFile(request.output, serialize(measurement))
  })().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = 1
  })
}
