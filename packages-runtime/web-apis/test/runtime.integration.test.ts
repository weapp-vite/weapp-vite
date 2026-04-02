import axios from 'axios'
import { request as gqlRequest } from 'graphql-request'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installRequestGlobals } from '../src'

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
  beforeEach(() => {
    wpiRequestMock.mockReset()
    for (const key of GLOBAL_KEYS) {
      originalGlobals.set(key, (globalThis as Record<string, unknown>)[key])
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
  })

  afterEach(() => {
    for (const key of GLOBAL_KEYS) {
      setGlobalValue(key, originalGlobals.get(key))
    }
    originalGlobals.clear()
  })

  it('supports fetch, graphql-request and axios through installed request globals', async () => {
    installRequestGlobals()

    const fetchResponse = await fetch('https://request-globals.test/fetch', {
      method: 'POST',
      body: JSON.stringify({ run: 1 }),
    })
    expect(await fetchResponse.json()).toEqual({
      transport: 'fetch',
      echo: '{"run":1}',
    })

    const graphqlPayload = await gqlRequest<{ transport: { client: string } }>(
      'https://request-globals.test/graphql',
      /* GraphQL */ `
        query RequestGlobalsTransport {
          transport {
            client
          }
        }
      `,
    )
    expect(graphqlPayload.transport.client).toBe('graphql-request')

    const axiosPayload = await axios.get('https://request-globals.test/axios', {
      adapter: 'fetch',
    })
    expect(axiosPayload.data.transport).toBe('axios')
    expect(wpiRequestMock).toHaveBeenCalledTimes(3)
  })
})
