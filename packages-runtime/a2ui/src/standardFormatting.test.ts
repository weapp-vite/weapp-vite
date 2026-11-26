import { describe, expect, it, vi } from 'vitest'
import { createSurfaceMessage, findNode, rootOf, setupSession, surfaceMessage } from './sessionTestUtils'
import { testCatalog } from './testFixture'

function path(value: string) {
  return { '@path': value }
}

function call(name: string, args: Record<string, unknown>) {
  return { '@call': name, args }
}

function text(id: string, name: string, args: Record<string, unknown>) {
  return { id, component: 'Text', text: call(name, args) }
}

describe('A2UI standard formatting', () => {
  it('uses deterministic Chinese formatting by default and reacts to data changes', () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Column', children: ['number', 'raw', 'plain', 'cny', 'date', 'plural'] },
      text('number', 'formatNumber', { value: path('/amount'), decimals: 2 }),
      text('raw', 'formatNumber', { value: path('/amount') }),
      text('plain', 'formatNumber', { value: path('/amount'), decimals: 2, grouping: false }),
      text('cny', 'formatCurrency', { value: path('/amount'), currency: 'cny' }),
      text('date', 'formatDate', { value: path('/timestamp'), format: 'yyyy年M月d日 EEEE HH:mm:ss a' }),
      text('plural', 'pluralize', { value: path('/count'), one: '一项', other: '项' }),
    ], {
      amount: 12345.678,
      timestamp: '2026-02-03T14:05:09',
      count: 1,
    }))

    expect(findNode(rootOf(result), 'number')?.props.text).toBe('12,345.68')
    expect(findNode(rootOf(result), 'raw')?.props.text).toBe('12,345.678')
    expect(findNode(rootOf(result), 'plain')?.props.text).toBe('12345.68')
    expect(findNode(rootOf(result), 'cny')?.props.text).toBe('¥12,345.68')
    expect(findNode(rootOf(result), 'date')?.props.text).toBe('2026年2月3日 星期二 14:05:09 PM')
    expect(findNode(rootOf(result), 'plural')?.props.text).toBe('项')

    result.session.receive(surfaceMessage('updateDataModel', {
      surfaceId: 's1',
      path: '/',
      value: { amount: 9876.5, timestamp: '2026-02-03T14:05:09', count: 2 },
    }))
    expect(findNode(rootOf(result), 'number')?.props.text).toBe('9,876.50')
    expect(findNode(rootOf(result), 'cny')?.props.text).toBe('¥9,876.50')
    expect(result.errors).toHaveLength(0)
    result.session.dispose()
  })

  it('supports explicit English formatting and English plural categories', () => {
    const result = setupSession(undefined, testCatalog, {}, 'en-US')
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Column', children: ['usd', 'date', 'one', 'many'] },
      text('usd', 'formatCurrency', { value: 1234.5, currency: 'USD' }),
      text('date', 'formatDate', { value: '2026-02-03T14:05:09', format: 'MMMM d, yyyy' }),
      text('one', 'pluralize', { value: 1, one: 'one item', other: 'items' }),
      text('many', 'pluralize', { value: 2, one: 'one item', other: 'items' }),
    ]))

    expect(findNode(rootOf(result), 'usd')?.props.text).toBe('$1,234.50')
    expect(findNode(rootOf(result), 'date')?.props.text).toBe('February 3, 2026')
    expect(findNode(rootOf(result), 'one')?.props.text).toBe('one item')
    expect(findNode(rootOf(result), 'many')?.props.text).toBe('items')
    result.session.dispose()
  })

  it('matches decimal rounding, large numbers, and ISO currency defaults', () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      {
        id: 'root',
        component: 'Column',
        children: ['large', 'rounded', 'negativeZero', 'jpy', 'kwd', 'clf', 'unknown', 'sgd', 'aud', 'negativeCurrency'],
      },
      text('large', 'formatNumber', { value: 1e21, decimals: 2 }),
      text('rounded', 'formatNumber', { value: 1.005, decimals: 2 }),
      text('negativeZero', 'formatNumber', { value: -0 }),
      text('jpy', 'formatCurrency', { value: 1234.5, currency: 'JPY' }),
      text('kwd', 'formatCurrency', { value: 1234.5, currency: 'KWD' }),
      text('clf', 'formatCurrency', { value: 1234.5, currency: 'CLF' }),
      text('unknown', 'formatCurrency', { value: 1234.5, currency: 'XYZ' }),
      text('sgd', 'formatCurrency', { value: 1234.5, currency: 'SGD' }),
      text('aud', 'formatCurrency', { value: 1234.5, currency: 'AUD' }),
      text('negativeCurrency', 'formatCurrency', { value: -0, currency: 'USD' }),
    ]))

    expect(findNode(rootOf(result), 'large')?.props.text).toBe('1,000,000,000,000,000,000,000.00')
    expect(findNode(rootOf(result), 'rounded')?.props.text).toBe('1.01')
    expect(findNode(rootOf(result), 'negativeZero')?.props.text).toBe('-0')
    expect(findNode(rootOf(result), 'jpy')?.props.text).toBe('JP¥1,235')
    expect(findNode(rootOf(result), 'kwd')?.props.text).toBe('KWD\u00A01,234.500')
    expect(findNode(rootOf(result), 'clf')?.props.text).toBe('CLF\u00A01,234.5000')
    expect(findNode(rootOf(result), 'unknown')?.props.text).toBe('XYZ\u00A01,234.50')
    expect(findNode(rootOf(result), 'sgd')?.props.text).toBe('SGD\u00A01,234.50')
    expect(findNode(rootOf(result), 'aud')?.props.text).toBe('AU$1,234.50')
    expect(findNode(rootOf(result), 'negativeCurrency')?.props.text).toBe('-US$0.00')
    expect(result.errors).toHaveLength(0)
    result.session.dispose()
  })

  it('preserves written wall-clock fields and rejects rolled-over dates', () => {
    const result = setupSession()
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Column', children: ['wallClock', 'iso', 'invalid'] },
      text('wallClock', 'formatDate', { value: '2026-02-03T14:05:09+08:00', format: 'yyyy-MM-dd HH:mm:ss' }),
      text('iso', 'formatDate', { value: '2026-02-03T14:05:09+08:00', format: 'ISO' }),
      text('invalid', 'formatDate', { value: '2026-02-30T14:05:09', format: 'yyyy-MM-dd' }),
    ]))

    expect(findNode(rootOf(result), 'wallClock')?.props.text).toBe('2026-02-03 14:05:09')
    expect(findNode(rootOf(result), 'iso')?.props.text).toBe('2026-02-03T06:05:09.000Z')
    expect(findNode(rootOf(result), 'invalid')?.props.text).toBe('')
    result.session.dispose()
  })

  it('does not require Intl and lets host implementations override formatting', () => {
    vi.stubGlobal('Intl', undefined)
    try {
      const builtin = setupSession()
      builtin.session.receive(createSurfaceMessage('s1', [
        { id: 'root', component: 'Text', text: call('formatNumber', { value: 1234.5, decimals: 1 }) },
      ]))
      expect(rootOf(builtin)?.props.text).toBe('1,234.5')
      builtin.session.dispose()

      const host = setupSession({ formatNumber: () => 'host' }, testCatalog)
      host.session.receive(createSurfaceMessage('s1', [
        { id: 'root', component: 'Text', text: call('formatNumber', { value: 1234.5 }) },
      ]))
      expect(rootOf(host)?.props.text).toBe('host')
      host.session.dispose()
    }
    finally {
      vi.unstubAllGlobals()
    }
  })
})
