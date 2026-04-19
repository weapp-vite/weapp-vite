import { request as gqlRequest, GraphQLClient } from 'graphql-request'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const wpiRequestMock = vi.hoisted(() => vi.fn())

vi.mock('@wevu/api', () => ({
  wpi: {
    request: wpiRequestMock,
  },
}))

const GLOBAL_KEYS = [
  'fetch',
  'Headers',
  'Request',
  'Response',
  'AbortController',
  'AbortSignal',
  'XMLHttpRequest',
  'URL',
  'URLSearchParams',
] as const

const RUNTIME_RESET_KEYS = [
  'fetch',
  'Headers',
  'Request',
  'Response',
  'AbortController',
  'AbortSignal',
  'XMLHttpRequest',
] as const

const originalGlobals = new Map<string, unknown>()

function setGlobalValue(key: string, value: unknown) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  })
}

function createMockResponse(url: string, data: unknown) {
  if (url.endsWith('/fetch')) {
    return {
      data: JSON.stringify({
        transport: 'fetch',
        echo: data ?? null,
      }),
      header: {
        'content-type': 'application/json',
      },
      statusCode: 200,
    }
  }

  if (url.endsWith('/axios')) {
    return {
      data: JSON.stringify({
        transport: 'axios',
      }),
      header: {
        'content-type': 'application/json',
      },
      statusCode: 200,
    }
  }

  return {
    data: JSON.stringify({
      data: {
        transport: {
          client: 'graphql-request',
        },
      },
    }),
    header: {
      'content-type': 'application/json',
    },
    statusCode: 200,
  }
}

describe('request globals third-party integration', () => {
  beforeEach(async () => {
    wpiRequestMock.mockReset()
    for (const key of GLOBAL_KEYS) {
      originalGlobals.set(key, (globalThis as Record<string, unknown>)[key])
    }
    for (const key of RUNTIME_RESET_KEYS) {
      setGlobalValue(key, undefined)
    }

    wpiRequestMock.mockImplementation((options: Record<string, any>) => {
      const result = createMockResponse(String(options.url ?? ''), options.data)
      options.success?.(result)
      options.complete?.(result)
      return {
        abort: vi.fn(),
      }
    })

    const { resetMiniProgramNetworkDefaults } = await import('../src')
    resetMiniProgramNetworkDefaults()
  })

  afterEach(() => {
    for (const key of GLOBAL_KEYS) {
      setGlobalValue(key, originalGlobals.get(key))
    }
    originalGlobals.clear()
  })

  it('supports fetch, graphql-request and axios through installed request globals', async () => {
    const { installRequestGlobals } = await import('../src')
    installRequestGlobals()
    const { default: axios } = await import('axios')

    const fetchResponse = await fetch('https://request-globals.invalid/fetch', {
      method: 'POST',
      body: JSON.stringify({ run: 1 }),
    })
    expect(await fetchResponse.json()).toEqual({
      transport: 'fetch',
      echo: '{"run":1}',
    })

    const graphqlPayload = await gqlRequest<{ transport: { client: string } }>(
      'https://request-globals.invalid/graphql',
      /* GraphQL */ `
        query RequestGlobalsTransport {
          transport {
            client
          }
        }
      `,
    )
    expect(graphqlPayload.transport.client).toBe('graphql-request')

    const axiosPayload = await axios.get('https://request-globals.invalid/axios', {
      adapter: 'fetch',
    })
    expect(axiosPayload.data.transport).toBe('axios')
    expect(wpiRequestMock).toHaveBeenCalledTimes(3)
  })

  it('forwards axios fetchOptions miniProgram extensions to the underlying request bridge', async () => {
    const { installRequestGlobals } = await import('../src')
    installRequestGlobals()
    const { default: axios } = await import('axios')

    const axiosPayload = await axios.get('https://request-globals.invalid/axios', {
      adapter: 'fetch',
      fetchOptions: {
        miniProgram: {
          enableHttp2: true,
          timeout: 4_321,
        },
      },
    })

    expect(axiosPayload.data.transport).toBe('axios')
    expect(wpiRequestMock).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://request-globals.invalid/axios',
      method: 'GET',
      enableHttp2: true,
      timeout: 4_321,
    }))
  })

  it('supports graphql-request fetchOptions and axios xhr defaults through runtime defaults', async () => {
    const {
      installRequestGlobals,
      setMiniProgramNetworkDefaults,
    } = await import('../src')
    installRequestGlobals()
    setMiniProgramNetworkDefaults({
      request: {
        enableHttp2: true,
        timeout: 4_321,
      },
    })
    const { default: axios } = await import('axios')

    const client = new GraphQLClient('https://request-globals.invalid/graphql', {
      miniProgram: {
        enableChunked: true,
      },
    })

    const graphqlPayload = await client.request<{ transport: { client: string } }>(
      /* GraphQL */ `
        query RequestGlobalsTransport {
          transport {
            client
          }
        }
      `,
    )
    expect(graphqlPayload.transport.client).toBe('graphql-request')

    const axiosPayload = await axios.get('https://request-globals.invalid/axios', {
      adapter: 'xhr',
    })
    expect(axiosPayload.data.transport).toBe('axios')

    expect(wpiRequestMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      enableChunked: true,
      enableHttp2: true,
      timeout: 4_321,
      url: 'https://request-globals.invalid/graphql',
    }))
    expect(wpiRequestMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      enableHttp2: true,
      timeout: 4_321,
      url: 'https://request-globals.invalid/axios',
    }))
  })

  it('replaces broken host URL constructors before graphql-request and axios use them', async () => {
    setGlobalValue('URL', () => undefined)
    setGlobalValue('URLSearchParams', () => undefined)

    const { installRequestGlobals } = await import('../src')
    installRequestGlobals()
    const { default: axios } = await import('axios')

    const graphqlPayload = await gqlRequest<{ transport: { client: string } }>(
      'https://request-globals.invalid/graphql',
      /* GraphQL */ `
        query RequestGlobalsTransport {
          transport {
            client
          }
        }
      `,
    )
    expect(graphqlPayload.transport.client).toBe('graphql-request')

    const axiosPayload = await axios.get('https://request-globals.invalid/axios', {
      adapter: 'fetch',
    })
    expect(axiosPayload.data.transport).toBe('axios')
    expect(wpiRequestMock).toHaveBeenCalledTimes(2)
  })
})
