import { runInNewContext } from 'node:vm'
import { afterEach, expect, it, vi } from 'vitest'
import { requestHistoricalBaselineShutdown } from './historicalShutdown'

interface RemoteObject { type?: string, objectId?: string, value?: unknown }
interface Command { id: number, method: string, params: Record<string, any> }
interface FixtureCompiler { throwIfDisposed: () => void, dispose: () => unknown }

function inspectorFixture() {
  const cache: Record<string, { exports: unknown }> = {}
  const instances = new Map<object, object[]>()
  const events: string[] = []
  const commands: Command[] = []
  const objects = new Map<string, any>()
  let nextObject = 0
  const require = Object.assign(vi.fn(() => {
    throw new Error('Shutdown must not load modules')
  }), { cache })
  const createRequire = vi.fn(() => require)
  const fakeProcess = {
    exitCode: undefined as number | string | undefined,
    getBuiltinModule: vi.fn((name: string) => {
      expect(name).toBe('node:module')
      return { createRequire }
    }),
    listenerCount: vi.fn(() => 1),
    emit: vi.fn(() => {
      events.push('SIGINT')
      return true
    }),
  }
  const keepAliveTimers = new Set<object>()
  const context = {
    process: fakeProcess,
    setInterval: vi.fn(() => {
      const timer = {}
      keepAliveTimers.add(timer)
      return timer
    }),
    clearInterval: vi.fn((timer: object) => keepAliveTimers.delete(timer)),
  }
  const remote = (value: unknown, byValue = false): RemoteObject => {
    if (value !== null && (typeof value === 'object' || typeof value === 'function') && !byValue) {
      const objectId = String(++nextObject)
      objects.set(objectId, value)
      return { type: typeof value, objectId }
    }
    return { type: typeof value, value }
  }
  const runtimeResult = async (run: () => unknown, byValue?: boolean) => {
    try {
      return { result: remote(await run(), byValue) }
    }
    catch (error) {
      return { exceptionDetails: { exception: { description: String(error) } } }
    }
  }
  const execute = async ({ method, params }: Command) => {
    if (method === 'Runtime.evaluate') {
      return runtimeResult(() => runInNewContext(params.expression, context), params.returnByValue)
    }
    if (method === 'Runtime.callFunctionOn') {
      expect(params.awaitPromise).toBe(true)
      const callable = runInNewContext(`(${params.functionDeclaration})`, context) as (...args: unknown[]) => unknown
      const args = (params.arguments as RemoteObject[]).map(arg => arg.objectId ? objects.get(arg.objectId) : arg.value)
      return runtimeResult(() => callable.apply(objects.get(params.objectId), args), params.returnByValue)
    }
    if (method === 'Runtime.getProperties') {
      const value = objects.get(params.objectId)
      return { result: Object.getOwnPropertyNames(value).map(name => ({ name, value: remote(value[name]) })) }
    }
    if (method === 'Runtime.queryObjects') {
      return { objects: remote(instances.get(objects.get(params.prototypeObjectId)) ?? []) }
    }
    throw new Error(`Unexpected inspector method: ${method}`)
  }
  const sockets: InspectorSocket[] = []
  let intercept: ((command: Command) => unknown) | undefined
  class InspectorSocket extends EventTarget {
    close = vi.fn()
    send = vi.fn((text: string) => {
      const request = JSON.parse(text) as Command
      commands.push(request)
      void Promise.resolve().then(async () => intercept ? await intercept(request) : await execute(request)).then((result) => {
        this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ id: request.id, result }) }))
      }, (error: unknown) => {
        this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ id: request.id, error: { message: String(error) } }) }))
      })
    })

    constructor() {
      super()
      sockets.push(this)
      queueMicrotask(() => this.dispatchEvent(new Event('open')))
    }
  }
  vi.stubGlobal('WebSocket', InspectorSocket)
  function addSass(name: string, disposers: Array<() => unknown>) {
    class Compiler implements FixtureCompiler {
      throwIfDisposed() {}
      compile() { this.throwIfDisposed() }
      dispose() {
        events.push(`dispose:${name}`)
        return disposers[instances.get(Compiler.prototype)!.indexOf(this)]!()
      }
    }
    const compilers = disposers.map(() => new Compiler())
    instances.set(Compiler.prototype, compilers)
    cache[name] = { exports: { info: `sass-embedded${String.fromCharCode(9)}1.105.0`, AsyncCompiler: Compiler } }
    return { compilers, prototype: Compiler.prototype }
  }
  return {
    cache,
    instances,
    events,
    commands,
    require,
    createRequire,
    process: fakeProcess,
    sockets,
    keepAliveTimers,
    addSass,
    execute,
    intercept: (handler: typeof intercept) => {
      intercept = handler
    },
  }
}

afterEach(() => vi.unstubAllGlobals())
const inspectorUrl = 'ws://127.0.0.1:1/registered-inspector'
const measuredCli = 'C:\\measured checkout\\packages\\weapp-vite\\bin\\weapp-vite.js'

it('keeps native shutdown working without loading an unused Sass module', async () => {
  const fixture = inspectorFixture()
  await expect(requestHistoricalBaselineShutdown(inspectorUrl, measuredCli)).resolves.toBeUndefined()
  expect(fixture.createRequire).toHaveBeenCalledWith(measuredCli)
  expect(fixture.require).not.toHaveBeenCalled()
  expect(fixture.commands.some(command => command.method === 'Runtime.queryObjects')).toBe(false)
  expect(fixture.events).toEqual(['SIGINT'])
  expect(fixture.keepAliveTimers.size).toBe(0)
  expect(fixture.sockets[0]?.close).toHaveBeenCalledTimes(1)
})

it('seals each loaded Sass copy before signaling and awaits every original disposer', async () => {
  const fixture = inspectorFixture()
  const pending = Promise.withResolvers<void>()
  fixture.addSass('first', [() => pending.promise])
  fixture.cache.duplicate = fixture.cache.first!
  fixture.addSass('second', [() => undefined])
  let finished = false
  const shutdown = requestHistoricalBaselineShutdown(inspectorUrl, measuredCli).then(() => {
    finished = true
  })
  await vi.waitFor(() => expect(fixture.events).toEqual(['SIGINT', 'dispose:first', 'dispose:second']))
  expect(finished).toBe(false)
  expect(fixture.keepAliveTimers.size).toBe(1)
  pending.resolve()
  await shutdown
  expect(fixture.events).toEqual(['SIGINT', 'dispose:first', 'dispose:second'])
  expect(fixture.commands.filter(command => command.method === 'Runtime.queryObjects')).toHaveLength(2)
  expect(fixture.commands.at(-1)?.params.functionDeclaration).toContain('clearInterval(this.keepAlive)')
  expect(fixture.keepAliveTimers.size).toBe(0)
})

it('attempts every original disposer and preserves synchronous and async failures', async () => {
  const fixture = inspectorFixture()
  fixture.addSass('broken', [() => {
    throw new Error('first dispose failure')
  }, () => Promise.reject(new Error('second dispose failure'))])
  fixture.addSass('healthy', [() => undefined])
  const error = await requestHistoricalBaselineShutdown(inspectorUrl, measuredCli).catch(error => error) as AggregateError
  expect(error).toBeInstanceOf(AggregateError)
  expect(error.errors.map(String).join('\n')).toContain('first dispose failure')
  expect(error.errors.map(String).join('\n')).toContain('second dispose failure')
  expect(fixture.events).toEqual(['SIGINT', 'dispose:broken', 'dispose:broken', 'dispose:healthy'])
  expect(fixture.keepAliveTimers.size).toBe(0)
  expect(fixture.sockets[0]?.close).toHaveBeenCalledTimes(1)
})

it('rejects a late pre-bound compile even when the legacy caller swallows its exception', async () => {
  const fixture = inspectorFixture()
  const { compilers } = fixture.addSass('active', [() => undefined])
  const compile = compilers[0]!.compile.bind(compilers[0])
  fixture.process.emit.mockImplementation(() => {
    fixture.events.push('SIGINT')
    try {
      compile()
    }
    catch {}
    return true
  })
  const error = await requestHistoricalBaselineShutdown(inspectorUrl, measuredCli).catch(error => error) as AggregateError
  expect(error.errors.map(String).join('\n')).toContain('Historical Sass shutdown guard rejected late compilation')
  expect(fixture.process.exitCode).toBe(1)
  expect(fixture.events).toEqual(['SIGINT', 'dispose:active'])
  expect(() => compile()).toThrow('Historical Sass compilation started after shutdown was sealed')
})

it('preserves an existing failure exit status when rejecting late compilation', async () => {
  const fixture = inspectorFixture()
  const { compilers } = fixture.addSass('active', [() => undefined])
  await requestHistoricalBaselineShutdown(inspectorUrl, measuredCli)
  fixture.process.exitCode = 7
  expect(() => compilers[0]!.compile()).toThrow('Historical Sass compilation started after shutdown was sealed')
  expect(fixture.process.exitCode).toBe(7)
})

it('marks a zero string exit status as failed when rejecting late compilation', async () => {
  const fixture = inspectorFixture()
  const { compilers } = fixture.addSass('active', [() => undefined])
  await requestHistoricalBaselineShutdown(inspectorUrl, measuredCli)
  fixture.process.exitCode = '0'
  expect(() => compilers[0]!.compile()).toThrow('Historical Sass compilation started after shutdown was sealed')
  expect(fixture.process.exitCode).toBe(1)
})

it('calls an instance original disposer instead of bypassing it through the prototype', async () => {
  const fixture = inspectorFixture()
  const { compilers } = fixture.addSass('active', [() => undefined])
  const dispose = vi.fn(function (this: unknown) {
    expect(this).toBe(compilers[0])
  })
  compilers[0]!.dispose = dispose
  await requestHistoricalBaselineShutdown(inspectorUrl, measuredCli)
  expect(dispose).toHaveBeenCalledTimes(1)
  expect(fixture.events).toEqual(['SIGINT'])
})

it.each([
  [class {}, 'does not expose the verified shutdown contract'],
  [undefined, 'does not expose AsyncCompiler'],
])('preserves a broken historical capability and still closes other copies (%s)', async (AsyncCompiler, message) => {
  const fixture = inspectorFixture()
  fixture.cache.broken = { exports: { info: `sass-embedded${String.fromCharCode(9)}1.105.0`, AsyncCompiler } }
  fixture.addSass('healthy', [() => undefined])
  const error = await requestHistoricalBaselineShutdown(inspectorUrl, measuredCli).catch(error => error) as AggregateError
  expect(error.errors.map(String).join('\n')).toContain(message)
  expect(fixture.events).toEqual(['SIGINT', 'dispose:healthy'])
})

it('preserves a missing query receipt and still attempts other copies and the original signal path', async () => {
  const fixture = inspectorFixture()
  fixture.addSass('active', [() => undefined])
  fixture.addSass('healthy', [() => undefined])
  let queryCount = 0
  fixture.intercept(command => command.method === 'Runtime.queryObjects' && ++queryCount === 1 ? {} : fixture.execute(command))
  const error = await requestHistoricalBaselineShutdown(inspectorUrl, measuredCli).catch(error => error) as AggregateError
  expect(error.errors.map(String).join('\n')).toContain('did not enumerate compiler instances')
  expect(fixture.events).toEqual(['SIGINT', 'dispose:healthy'])
})

it('rejects an unconfirmed SIGINT while still attempting registered Sass disposal', async () => {
  const fixture = inspectorFixture()
  fixture.addSass('active', [() => undefined])
  fixture.process.listenerCount.mockReturnValue(0)
  const error = await requestHistoricalBaselineShutdown(inspectorUrl, measuredCli).catch(error => error) as AggregateError
  expect(error.errors.map(String).join('\n')).toContain('did not deliver SIGINT to a registered handler')
  expect(fixture.events).toEqual(['dispose:active'])
})

it('keeps inspector transport failure and closes the single connection', async () => {
  const fixture = inspectorFixture()
  fixture.intercept(() => {
    throw new Error('inspector unavailable')
  })
  const error = await requestHistoricalBaselineShutdown(inspectorUrl, measuredCli).catch(error => error) as AggregateError
  expect(error.errors.map(String).join('\n')).toContain('inspector unavailable')
  expect(fixture.sockets).toHaveLength(1)
  expect(fixture.sockets[0]?.close).toHaveBeenCalledTimes(1)
})

it('releases stop-only control after a disposer exhausts the operation deadline', async () => {
  const fixture = inspectorFixture()
  fixture.addSass('pending', [() => new Promise(() => {})])
  fixture.addSass('healthy', [() => undefined])
  const error = await requestHistoricalBaselineShutdown(inspectorUrl, measuredCli, 30).catch(error => error) as AggregateError
  expect(error.errors.map(String).join('\n')).toContain('Timed out waiting for inspector command Runtime.callFunctionOn')
  expect(fixture.events).toEqual(['SIGINT', 'dispose:pending', 'dispose:healthy'])
  expect(fixture.keepAliveTimers.size).toBe(0)
  expect(fixture.sockets[0]?.close).toHaveBeenCalledTimes(1)
})

it.each(['Sass disposal', 'late compilation check', 'control release'])('requires positive confirmation for %s', async (stage) => {
  const fixture = inspectorFixture()
  fixture.addSass('active', [() => undefined])
  const marker = stage === 'Sass disposal' ? 'Promise.allSettled(this.map' : stage === 'late compilation check' ? 'this.failures.length' : 'clearInterval(this.keepAlive)'
  fixture.intercept(command => command.method === 'Runtime.callFunctionOn' && command.params.functionDeclaration.includes(marker)
    ? { result: { value: false } }
    : fixture.execute(command))
  const error = await requestHistoricalBaselineShutdown(inspectorUrl, measuredCli).catch(error => error) as AggregateError
  expect(error.errors.map(String).join('\n')).toContain(`${stage} did not confirm completion`)
})
