import { afterEach, expect, it, vi } from 'vitest'
import { HISTORICAL_SHUTDOWN_WORK_BUDGET_MS, requestHistoricalBaselineShutdown } from './historicalShutdown'
import { inspectorFixture } from './historicalShutdown/inspectorFixture'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
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
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  const fixture = inspectorFixture()
  fixture.addSass('pending', [() => new Promise(() => {})])
  fixture.addSass('healthy', [() => undefined])
  fixture.intercept(async command => command.params.functionDeclaration?.includes('clearInterval(this.keepAlive)')
    ? await new Promise(resolve => setTimeout(() => resolve(fixture.execute(command)), 500))
    : await fixture.execute(command))
  const failure = requestHistoricalBaselineShutdown(inspectorUrl, measuredCli, 30).catch(error => error)
  await vi.advanceTimersByTimeAsync(30)
  expect(fixture.keepAliveTimers.size).toBe(1)
  await vi.advanceTimersByTimeAsync(500)
  const error = await failure as AggregateError
  expect(error.errors.map(String).join('\n')).toContain('Timed out waiting for inspector command Runtime.callFunctionOn')
  expect(error.errors.map(String).join('\n')).not.toContain('control release')
  expect(fixture.events).toEqual(['SIGINT', 'dispose:pending', 'dispose:healthy'])
  expect(fixture.keepAliveTimers.size).toBe(0)
  expect(fixture.sockets[0]?.close).toHaveBeenCalledTimes(1)
})

it('strictly fails control release after its independent one-second budget', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  const fixture = inspectorFixture()
  fixture.intercept(command => command.params.functionDeclaration?.includes('clearInterval(this.keepAlive)')
    ? new Promise(() => {})
    : fixture.execute(command))
  let finished = false
  const failure = requestHistoricalBaselineShutdown(inspectorUrl, measuredCli).catch((error: AggregateError) => {
    finished = true
    return error
  })
  await vi.advanceTimersByTimeAsync(999)
  expect(finished).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  const error = await failure as AggregateError
  expect(error.errors.map(String).join('\n')).toContain('Timed out waiting for inspector command Runtime.callFunctionOn after 1000ms')
  expect(fixture.keepAliveTimers.size).toBe(1)
  expect(fixture.sockets[0]?.close).toHaveBeenCalledTimes(1)
})

it('allows a fifteen-second inspector query within the existing graceful shutdown budget', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  const fixture = inspectorFixture()
  fixture.addSass('active', [() => undefined])
  fixture.intercept(async command => command.method === 'Runtime.queryObjects'
    ? await new Promise(resolve => setTimeout(() => resolve(fixture.execute(command)), 15_000))
    : await fixture.execute(command))
  let finished = false
  const shutdown = requestHistoricalBaselineShutdown(inspectorUrl, measuredCli).then(() => {
    finished = true
  })
  await vi.advanceTimersByTimeAsync(14_999)
  expect(finished).toBe(false)
  expect(fixture.events).toEqual([])
  await vi.advanceTimersByTimeAsync(1)
  await shutdown
  expect(finished).toBe(true)
  expect(fixture.events).toEqual(['SIGINT', 'dispose:active'])
  expect(fixture.commands.filter(command => command.method === 'Runtime.queryObjects')).toHaveLength(1)
  expect(fixture.keepAliveTimers.size).toBe(0)
})

it('fails when cumulative queries exhaust the total budget and still releases control', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  const fixture = inspectorFixture()
  fixture.addSass('first', [() => undefined])
  fixture.addSass('second', [() => undefined])
  fixture.intercept(async command => command.method === 'Runtime.queryObjects'
    ? await new Promise(resolve => setTimeout(() => resolve(fixture.execute(command)), 45_000))
    : await fixture.execute(command))
  let finished = false
  const failure = requestHistoricalBaselineShutdown(inspectorUrl, measuredCli).catch((error: AggregateError) => {
    finished = true
    return error
  })
  await vi.advanceTimersByTimeAsync(HISTORICAL_SHUTDOWN_WORK_BUDGET_MS - 1)
  expect(finished).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  const error = await failure as AggregateError
  expect(error.errors.map(String).join('\n')).toContain('Timed out waiting for inspector command Runtime.queryObjects')
  expect(fixture.commands.filter(command => command.method === 'Runtime.queryObjects')).toHaveLength(2)
  expect(fixture.events).toEqual([])
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
