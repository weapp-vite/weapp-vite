import { describe, expect, it } from 'vitest'
import {
  injectBaseUrlIntoProjectPrivateConfig,
  mergeRequestClientsRealQuery,
} from '../utils/requestClientsRealDevPlugin'

describe('requestClientsRealDevPlugin helpers', () => {
  it('injects baseUrl into empty query strings', () => {
    expect(mergeRequestClientsRealQuery('', 'http://127.0.0.1:3000')).toBe(
      'baseUrl=http%3A%2F%2F127.0.0.1%3A3000',
    )
  })

  it('preserves existing query parameters while overriding baseUrl', () => {
    expect(mergeRequestClientsRealQuery('foo=1&baseUrl=http%3A%2F%2Fold', 'http://127.0.0.1:3001')).toBe(
      'foo=1&baseUrl=http%3A%2F%2F127.0.0.1%3A3001',
    )
  })

  it('patches all miniprogram launch conditions', () => {
    const next = injectBaseUrlIntoProjectPrivateConfig(JSON.stringify({
      condition: {
        miniprogram: {
          list: [
            {
              name: 'pages/index/index',
              pathName: 'pages/index/index',
              query: '',
            },
            {
              name: 'pages/fetch/index',
              pathName: 'pages/fetch/index',
              query: 'foo=1',
            },
          ],
        },
      },
    }), 'http://127.0.0.1:3002')

    expect(next).toContain('"query": "baseUrl=http%3A%2F%2F127.0.0.1%3A3002"')
    expect(next).toContain('"query": "foo=1&baseUrl=http%3A%2F%2F127.0.0.1%3A3002"')
  })

  it('keeps source unchanged when launch conditions are missing', () => {
    const source = JSON.stringify({
      condition: {
        miniprogram: {},
      },
    })

    expect(injectBaseUrlIntoProjectPrivateConfig(source, 'http://127.0.0.1:3003')).toBe(source)
  })
})
