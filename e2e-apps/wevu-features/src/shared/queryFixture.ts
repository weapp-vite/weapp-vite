export const QUERY_LIST_KEY_PREFIX = ['wevu-query-fixture', 'list'] as const

export interface QueryFixtureItem {
  id: string
  title: string
}

export interface QueryListPayload {
  filter: string
  items: QueryFixtureItem[]
  requestId: string
  revision: number
}

export interface QueryMutationPayload {
  id: string
  revision: number
}

export interface QueryMutationVariables {
  id: string
}

export type QueryListKey = readonly [
  typeof QUERY_LIST_KEY_PREFIX[0],
  typeof QUERY_LIST_KEY_PREFIX[1],
  string,
  string,
]

interface RequestOptions {
  data?: QueryMutationVariables
  method?: 'GET' | 'POST'
}

type ResponseParser<T> = (value: unknown) => T

function isQueryFixtureItem(value: unknown): value is QueryFixtureItem {
  return value !== null
    && typeof value === 'object'
    && 'id' in value
    && typeof value.id === 'string'
    && 'title' in value
    && typeof value.title === 'string'
}

function parseQueryListPayload(value: unknown): QueryListPayload {
  if (
    value === null
    || typeof value !== 'object'
    || !('filter' in value)
    || typeof value.filter !== 'string'
    || !('requestId' in value)
    || typeof value.requestId !== 'string'
    || !('revision' in value)
    || typeof value.revision !== 'number'
    || !Number.isInteger(value.revision)
    || !('items' in value)
    || !Array.isArray(value.items)
    || !value.items.every(isQueryFixtureItem)
  ) {
    throw new Error('query fixture returned an invalid list payload')
  }
  return value as unknown as QueryListPayload
}

function parseQueryMutationPayload(value: unknown): QueryMutationPayload {
  if (
    value === null
    || typeof value !== 'object'
    || !('id' in value)
    || typeof value.id !== 'string'
    || !('revision' in value)
    || typeof value.revision !== 'number'
    || !Number.isInteger(value.revision)
  ) {
    throw new Error('query fixture returned an invalid mutation payload')
  }
  return value as unknown as QueryMutationPayload
}

function formatRequestError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }
  try {
    return JSON.stringify(error) ?? String(error)
  }
  catch {
    return String(error)
  }
}

function requestJson<T>(url: string, parse: ResponseParser<T>, options: RequestOptions = {}) {
  return new Promise<T>((resolve, reject) => {
    wx.request({
      data: options.data,
      dataType: 'json',
      fail(error) {
        reject(new Error(`query fixture request failed: ${formatRequestError(error)}`))
      },
      method: options.method ?? 'GET',
      success(result) {
        if (result.statusCode < 200 || result.statusCode >= 300) {
          reject(new Error(`query fixture request returned ${result.statusCode}: ${url}`))
          return
        }
        try {
          resolve(parse(result.data))
        }
        catch (error) {
          reject(error)
        }
      },
      url,
    })
  })
}

export function createQueryListKey(baseUrl: string, filter: string): QueryListKey {
  return [...QUERY_LIST_KEY_PREFIX, baseUrl, filter]
}

export function fetchQueryList(baseUrl: string, filter: string) {
  const url = `${baseUrl.replace(/\/+$/, '')}/query/items?filter=${encodeURIComponent(filter)}`
  return requestJson(url, parseQueryListPayload)
}

export function updateQueryItem(baseUrl: string, variables: QueryMutationVariables) {
  const url = `${baseUrl.replace(/\/+$/, '')}/query/items/${encodeURIComponent(variables.id)}`
  return requestJson(url, parseQueryMutationPayload, {
    data: variables,
    method: 'POST',
  })
}

export function readRouteParameter(query: Record<string, unknown> | undefined, name: string) {
  const value = query?.[name]
  return typeof value === 'string' ? decodeURIComponent(value) : ''
}
