import type { IncomingMessage, ServerResponse } from 'node:http'
import type { HeadlessSession, HeadlessWxRequestSuccessResult } from '../../mpcore/packages/simulator/src'
import fs from 'node:fs'
import { createServer } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { URL } from 'node:url'
import { x } from 'tinyexec'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHeadlessSession } from '../../mpcore/packages/simulator/src'
import { installQueryRequestTransport } from './queryRequestTransport'

interface TestServerHandle {
  baseUrl: string
  stop: () => Promise<void>
}

type TestServerHandler = (request: IncomingMessage, response: ServerResponse) => void | Promise<void>

async function startTestServer(handler: TestServerHandler): Promise<TestServerHandle> {
  const server = createServer((request, response) => {
    void Promise.resolve(handler(request, response)).catch((error) => {
      response.statusCode = 500
      response.end(error instanceof Error ? error.message : String(error))
    })
  })
  const listening = Promise.withResolvers<void>()
  server.once('error', listening.reject)
  server.listen(0, '127.0.0.1', listening.resolve)
  await listening.promise
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Query request transport test server did not expose a TCP port')
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    stop: () => {
      const stopped = Promise.withResolvers<void>()
      server.close(error => error ? stopped.reject(error) : stopped.resolve())
      return stopped.promise
    },
  }
}

function createTestSession(tempDirs: string[]) {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'query-request-transport-'))
  tempDirs.push(projectPath)
  fs.mkdirSync(path.join(projectPath, 'dist/pages/index'), { recursive: true })
  fs.writeFileSync(path.join(projectPath, 'project.config.json'), JSON.stringify({
    appid: 'wx-query-request-transport',
    miniprogramRoot: 'dist',
  }))
  fs.writeFileSync(path.join(projectPath, 'dist/app.json'), JSON.stringify({
    pages: ['pages/index/index'],
  }))
  fs.writeFileSync(path.join(projectPath, 'dist/app.js'), 'App({})\n')
  fs.writeFileSync(path.join(projectPath, 'dist/pages/index/index.js'), 'Page({})\n')
  fs.writeFileSync(path.join(projectPath, 'dist/pages/index/index.wxml'), '<view />\n')
  return createHeadlessSession({ projectPath, strictHostMocks: true })
}

describe('query request transport', () => {
  const sessions: HeadlessSession[] = []
  const servers: TestServerHandle[] = []
  const tempDirs: string[] = []
  const transportDisposers: Array<() => void> = []

  afterEach(async () => {
    for (const dispose of transportDisposers.splice(0)) {
      dispose()
    }
    for (const session of sessions.splice(0)) {
      session.close()
    }
    for (const server of servers.splice(0)) {
      await server.stop()
    }
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { force: true, recursive: true })
    }
  })

  it('sends POST JSON and maps the real response body, headers, cookies and status', async () => {
    let receivedBody = ''
    let receivedContentType: string | undefined
    let receivedHeader: string | undefined
    let receivedMethod: string | undefined
    const server = await startTestServer(async (request, response) => {
      for await (const chunk of request) {
        receivedBody += chunk.toString()
      }
      receivedContentType = request.headers['content-type']
      receivedHeader = request.headers['x-query-client'] as string | undefined
      receivedMethod = request.method
      response.statusCode = 201
      response.setHeader('content-type', 'application/json; charset=utf-8')
      response.setHeader('set-cookie', ['query-session=one', 'query-scope=two'])
      response.setHeader('x-query-response', 'created')
      response.end(JSON.stringify({ id: 'item-1', saved: true }))
    })
    servers.push(server)
    const session = createTestSession(tempDirs)
    sessions.push(session)
    const dispose = installQueryRequestTransport(session, server.baseUrl)
    transportDisposers.push(dispose)
    const success = vi.fn()
    const fail = vi.fn()
    const complete = vi.fn()

    const completed = Promise.withResolvers<void>()
    session.getWx().request({
      complete(result) {
        complete(result)
        completed.resolve()
      },
      data: { id: 'item-1', revision: 3 },
      fail,
      header: { 'x-query-client': 'headless' },
      method: 'POST',
      success,
      url: `${server.baseUrl}/query/items/item-1`,
    })
    await completed.promise

    expect(receivedBody).toBe('{"id":"item-1","revision":3}')
    expect(receivedContentType).toBe('application/json')
    expect(receivedMethod).toBe('POST')
    expect(receivedHeader).toBe('headless')
    expect(fail).not.toHaveBeenCalled()
    expect(success).toHaveBeenCalledTimes(1)
    const result = success.mock.calls[0]?.[0] as HeadlessWxRequestSuccessResult
    expect(result).toEqual({
      cookies: ['query-session=one', 'query-scope=two'],
      data: { id: 'item-1', saved: true },
      errMsg: 'request:ok',
      header: expect.objectContaining({
        'content-type': 'application/json; charset=utf-8',
        'x-query-response': 'created',
      }),
      statusCode: 201,
    })
    expect(complete).toHaveBeenCalledOnce()
    expect(complete).toHaveBeenCalledWith(result)
  })

  it('confines real requests to the configured exact origin and query paths', async () => {
    let requestCount = 0
    const server = await startTestServer((_request, response) => {
      requestCount += 1
      response.setHeader('content-type', 'application/json')
      response.end('{"items":[]}')
    })
    servers.push(server)
    const session = createTestSession(tempDirs)
    sessions.push(session)

    expect(() => installQueryRequestTransport(session, server.baseUrl.replace('http:', 'https:')))
      .toThrow('exact dynamic loopback origin')
    expect(() => installQueryRequestTransport(session, `${server.baseUrl}/query`))
      .toThrow('exact dynamic loopback origin')

    const dispose = installQueryRequestTransport(session, server.baseUrl)
    transportDisposers.push(dispose)
    const completed = Promise.withResolvers<void>()
    session.getWx().request({
      complete() {
        completed.resolve()
      },
      fail: completed.reject,
      url: `${server.baseUrl}/query/items?filter=allowed`,
    })
    await completed.promise

    const configuredUrl = new URL(server.baseUrl)
    const otherPort = configuredUrl.port === '65535' ? 65_534 : Number(configuredUrl.port) + 1
    expect(() => session.getWx().request({
      url: `${server.baseUrl}/query/not-allowed`,
    })).toThrow('No request mock matched in headless runtime')
    expect(() => session.getWx().request({
      url: `http://localhost:${configuredUrl.port}/query/items`,
    })).toThrow('No request mock matched in headless runtime')
    expect(() => session.getWx().request({
      url: `http://127.0.0.1:${otherPort}/query/items`,
    })).toThrow('No request mock matched in headless runtime')
    expect(requestCount).toBe(1)
  })

  it('rejects redirects without following their target or retaining an unfinished response body', async () => {
    let redirectedTargetRequests = 0
    let redirectResponse: ServerResponse | undefined
    let redirectClosed = false
    const server = await startTestServer((request, response) => {
      if (request.url === '/query/items/redirected') {
        redirectedTargetRequests += 1
        response.end('{"unexpected":true}')
        return
      }
      redirectResponse = response
      response.once('close', () => {
        redirectClosed = true
      })
      response.statusCode = 302
      response.setHeader('location', '/query/items/redirected')
      response.flushHeaders()
    })
    servers.push(server)
    const session = createTestSession(tempDirs)
    sessions.push(session)
    const dispose = installQueryRequestTransport(session, server.baseUrl)
    transportDisposers.push(dispose)
    const success = vi.fn()
    const fail = vi.fn()
    const complete = vi.fn()
    const completed = Promise.withResolvers<void>()
    try {
      session.getWx().request({
        complete() {
          complete()
          completed.resolve()
        },
        fail,
        success,
        url: `${server.baseUrl}/query/items?redirect=1`,
      })
      await completed.promise
      await expect.poll(() => redirectClosed, { timeout: 500 }).toBe(true)
      expect(redirectedTargetRequests).toBe(0)
      expect(success).not.toHaveBeenCalled()
      expect(fail).toHaveBeenCalledOnce()
      expect(fail.mock.calls[0]?.[0]).toMatchObject({
        message: 'request:fail redirect 302',
      })
      expect(complete).toHaveBeenCalledOnce()
    }
    finally {
      redirectResponse?.destroy()
    }
  })

  it('aborts idempotently without late success and dispose cancels work then restores strict requests', async () => {
    let requestCount = 0
    const firstStarted = Promise.withResolvers<void>()
    const secondStarted = Promise.withResolvers<void>()
    const firstResponseGate = Promise.withResolvers<void>()
    const secondResponseGate = Promise.withResolvers<void>()
    const firstHandlerFinished = Promise.withResolvers<void>()
    const secondHandlerFinished = Promise.withResolvers<void>()
    const server = await startTestServer(async (_request, response) => {
      requestCount += 1
      const responseGate = requestCount === 1 ? firstResponseGate : secondResponseGate
      const handlerFinished = requestCount === 1 ? firstHandlerFinished : secondHandlerFinished
      if (requestCount === 1) {
        firstStarted.resolve()
      }
      else if (requestCount === 2) {
        secondStarted.resolve()
      }
      await responseGate.promise
      if (!response.destroyed) {
        response.setHeader('content-type', 'application/json')
        response.end('{"late":true}')
      }
      handlerFinished.resolve()
    })
    servers.push(server)
    const session = createTestSession(tempDirs)
    sessions.push(session)
    const originalRequest = session.getWx().request
    const dispose = installQueryRequestTransport(session, server.baseUrl)
    transportDisposers.push(dispose)
    const firstSuccess = vi.fn()
    const firstFail = vi.fn()
    const firstComplete = vi.fn()
    const firstCompleted = Promise.withResolvers<void>()
    const firstTask = session.getWx().request({
      complete() {
        firstComplete()
        firstCompleted.resolve()
      },
      fail: firstFail,
      success: firstSuccess,
      url: `${server.baseUrl}/query/items?filter=first`,
    })

    await firstStarted.promise
    firstTask.abort()
    firstTask.abort()
    await firstCompleted.promise
    firstResponseGate.resolve()
    await firstHandlerFinished.promise
    expect(firstSuccess).not.toHaveBeenCalled()
    expect(firstFail).toHaveBeenCalledOnce()
    expect(firstFail.mock.calls[0]?.[0]).toMatchObject({ message: 'request:fail abort' })
    expect(firstComplete).toHaveBeenCalledOnce()

    const secondSuccess = vi.fn()
    const secondFail = vi.fn()
    const secondComplete = vi.fn()
    const secondCompleted = Promise.withResolvers<void>()
    session.getWx().request({
      complete() {
        secondComplete()
        secondCompleted.resolve()
      },
      fail: secondFail,
      success: secondSuccess,
      url: `${server.baseUrl}/query/items?filter=second`,
    })
    await secondStarted.promise
    dispose()
    dispose()
    await secondCompleted.promise
    secondResponseGate.resolve()
    await secondHandlerFinished.promise

    expect(secondSuccess).not.toHaveBeenCalled()
    expect(secondFail).toHaveBeenCalledOnce()
    expect(secondFail.mock.calls[0]?.[0]).toMatchObject({ message: 'request:fail abort' })
    expect(secondComplete).toHaveBeenCalledOnce()
    expect(session.getWx().request).toBe(originalRequest)
    expect(() => session.getWx().request({
      url: `${server.baseUrl}/query/items`,
    })).toThrow('No request mock matched in headless runtime')
  })

  it('revokes captured request references when the transport is disposed', async () => {
    let requestCount = 0
    const server = await startTestServer((_request, response) => {
      requestCount++
      response.end('unexpected')
    })
    servers.push(server)
    const session = createTestSession(tempDirs)
    sessions.push(session)
    const dispose = installQueryRequestTransport(session, server.baseUrl)
    transportDisposers.push(dispose)
    const capturedRequest = session.getWx().request
    dispose()
    expect(() => capturedRequest({ url: `${server.baseUrl}/query/items` }))
      .toThrow('No request mock matched in headless runtime')
    expect(requestCount).toBe(0)
  })

  it('aborts every pending request before reporting a disposal callback error', async () => {
    const responses: ServerResponse[] = []
    const started = Promise.withResolvers<void>()
    const server = await startTestServer((_request, response) => {
      responses.push(response)
      if (responses.length === 2) {
        started.resolve()
      }
    })
    servers.push(server)
    const session = createTestSession(tempDirs)
    sessions.push(session)
    const dispose = installQueryRequestTransport(session, server.baseUrl)
    transportDisposers.push(dispose)
    const callbackError = new Error('abort-callback-failed')
    const firstComplete = vi.fn()
    const secondComplete = vi.fn()
    session.getWx().request({
      url: `${server.baseUrl}/query/items/first`,
      fail() {
        throw callbackError
      },
      complete: firstComplete,
    })
    const secondTask = session.getWx().request({
      url: `${server.baseUrl}/query/items/second`,
      complete: secondComplete,
    })
    try {
      await started.promise
      let reported: unknown
      try {
        dispose()
      }
      catch (error) {
        reported = error
      }
      expect(firstComplete).toHaveBeenCalledOnce()
      expect(secondComplete).toHaveBeenCalledOnce()
      expect(reported).toBeInstanceOf(AggregateError)
      expect((reported as AggregateError).errors).toEqual([callbackError])
    }
    finally {
      secondTask.abort()
      for (const response of responses) {
        response.destroy()
      }
    }
  })

  it('reports asynchronous callback exceptions without reclassifying request results', async () => {
    const server = await startTestServer((request, response) => {
      response.setHeader('content-type', 'application/json')
      response.end(request.url?.includes('invalid') ? '{' : '{"ok":true}')
    })
    servers.push(server)
    sessions.push(createTestSession(tempDirs))
    // 独立进程观察未处理拒绝，避免把预期上报的异常交给 Vitest 的全局错误处理器。
    const script = `
      import { setImmediate } from 'node:timers/promises';
      import { createHeadlessSession } from ${JSON.stringify(new URL('../../mpcore/packages/simulator/src/index.ts', import.meta.url).href)};
      import { installQueryRequestTransport } from ${JSON.stringify(new URL('./queryRequestTransport.ts', import.meta.url).href)};
      const session = createHeadlessSession({ projectPath: process.argv[1], strictHostMocks: true });
      const dispose = installQueryRequestTransport(session, process.argv[2]);
      const reports = [];
      const counts = [];
      process.on('unhandledRejection', error => reports.push(error.message));
      for (const throwingCallback of ['success', 'fail', 'complete']) {
        const count = { success: 0, fail: 0, complete: 0 };
        const completed = Promise.withResolvers();
        const callbacks = {};
        for (const name of ['success', 'fail', 'complete']) {
          callbacks[name] = () => {
            count[name]++;
            if (name === 'complete') completed.resolve();
            if (name === throwingCallback) throw new Error('callback-' + name);
          };
        }
        session.getWx().request({
          ...callbacks,
          url: process.argv[2] + '/query/items' + (throwingCallback === 'fail' ? '?invalid=1' : ''),
        });
        await completed.promise;
        await setImmediate();
        counts.push(count);
      }
      dispose();
      session.close();
      console.log(JSON.stringify({ reports, counts }));
    `
    const { stdout } = await x(process.execPath, [
      '--import',
      'tsx',
      '--input-type=module',
      '--eval',
      script,
      tempDirs[tempDirs.length - 1]!,
      server.baseUrl,
    ], { timeout: 10_000, throwOnError: true })
    expect(JSON.parse(stdout) as unknown).toEqual({
      reports: ['callback-success', 'callback-fail', 'callback-complete'],
      counts: [
        { success: 1, fail: 0, complete: 1 },
        { success: 0, fail: 1, complete: 1 },
        { success: 1, fail: 0, complete: 1 },
      ],
    })
  })
})
