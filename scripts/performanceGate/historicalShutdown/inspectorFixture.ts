import { runInNewContext } from 'node:vm'
import { expect, vi } from 'vitest'

interface RemoteObject { type?: string, objectId?: string, value?: unknown }
interface Command { id: number, method: string, params: Record<string, any> }
interface FixtureCompiler { throwIfDisposed: () => void, dispose: () => unknown }

export function inspectorFixture() {
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
