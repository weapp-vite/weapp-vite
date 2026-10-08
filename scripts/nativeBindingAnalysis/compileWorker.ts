import type { CompileRequest, CompileResponse, CompileSample, CompileVariant } from './compileProtocol'
import type { BindingNative } from './replay'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { installCompileBatch } from './compileBatch'
import { collectIgnoredGlobals } from './globals'
import { createWorkerLifecycle } from './workerLifecycle'

const lifecycle = createWorkerLifecycle()

function send(value: CompileResponse) {
  return lifecycle.send(value)
}

/** 每种实现独占一个新进程，计时窗口只包含真实编译及同步清单消费。 */
async function main() {
  const mode = process.argv[2] as CompileVariant
  const bindingPath = process.argv[3]
  const rawBinding = mode === 'planned-native' ? createRequire(import.meta.url)(bindingPath!) as BindingNative : undefined
  let nativeFault: 'throw' | 'malformed' | undefined
  const binding: BindingNative | undefined = rawBinding && {
    analyzeBindingExpressionsNative(inputs, ignored) {
      if (nativeFault === 'throw') {
        throw new Error('Injected native execution failure')
      }
      if (nativeFault === 'malformed') {
        return []
      }
      return rawBinding.analyzeBindingExpressionsNative(inputs, ignored)
    },
  }
  const installed = mode === 'baseline' ? undefined : await installCompileBatch({ mode, binding, ignoredGlobals: collectIgnoredGlobals() })
  lifecycle.setDispose(() => installed?.dispose())
  const bindingSha256 = bindingPath ? createHash('sha256').update(await readFile(bindingPath)).digest('hex') : undefined
  const { compileVueFile } = await import('../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile')
  let running = false
  process.on('message', (request: CompileRequest) => lifecycle.run(async () => {
    if (running) {
      send({ id: request.id, kind: 'error', message: 'Overlapping compiler requests' })
      return
    }
    running = true
    try {
      if (request.kind === 'close') {
        lifecycle.close({ id: request.id, kind: 'closed' })
        return
      }
      installed?.reset()
      nativeFault = request.scenario.nativeFault
      const warnings: string[] = []
      let value: Awaited<ReturnType<typeof compileVueFile>> | undefined
      let error: { name: string, message: string } | undefined
      const initialCpu = process.cpuUsage()
      const start = performance.now()
      try {
        value = await compileVueFile(request.scenario.source, request.scenario.filename, {
          ...request.scenario.options,
          warn: message => warnings.push(message),
        })
      }
      catch (cause) {
        error = { name: cause instanceof Error ? cause.name : 'Error', message: cause instanceof Error ? cause.message : String(cause) }
      }
      const wallMs = performance.now() - start
      const cpu = process.cpuUsage(initialCpu)
      const rssAfterBytes = process.memoryUsage().rss
      installed?.assertDrained()
      const result: CompileSample = {
        output: JSON.stringify({ value, warnings, error }),
        wallMs,
        cpuMicroseconds: cpu.user + cpu.system,
        rssAfterBytes,
        failed: Boolean(error),
        metrics: installed?.snapshot() ?? {},
      }
      send({ id: request.id, kind: 'result', result })
    }
    catch (error) {
      send({ id: request.id, kind: 'error', message: error instanceof Error ? error.message : String(error) })
    }
    finally {
      running = false
    }
  }))
  send({ id: 0, kind: 'ready', sourceHashes: installed?.sourceHashes ?? {}, bindingSha256 })
}

lifecycle.run(main).catch(async (error: unknown) => {
  await send({ id: 0, kind: 'error', message: error instanceof Error ? error.message : String(error) })
  lifecycle.close(undefined, 1)
})
