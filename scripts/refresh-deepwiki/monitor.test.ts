import { describe, expect, it, vi } from 'vitest'
import { deepWikiUrl, formatSummary, monitorDeepWiki, readIndexStatus } from '../../.github/scripts/deepwiki/index.mjs'

const mainSha = 'a'.repeat(40)
const oldSha = 'b'.repeat(40)
const now = Date.UTC(2026, 9, 13)

function row(date = '5 October 2026', sha = oldSha, label = sha.slice(0, 8)) {
  return `<div><span>Last indexed: <!-- -->${date}</span> (<a href="https://github.com/weapp-vite/weapp-vite/commits/${sha}">${label}</a>)</div>`
}

function response(html = row(), status = 200, headers = {}) {
  return new Response(html, { status, headers: { 'content-type': 'text/html', ...headers } })
}

describe('DeepWiki read-only index monitor', () => {
  it('reads the date and commit from one index row', () => {
    expect(readIndexStatus(row(), now)).toEqual({ indexedSha: oldSha, indexedDate: '5 October 2026', indexedAt: Date.UTC(2026, 9, 5), ageDays: 8 })
  })

  it('accepts duplicate matching desktop and mobile index rows', () => {
    expect(readIndexStatus(row() + row(), now).indexedSha).toBe(oldSha)
  })

  it('rejects conflicting rows instead of choosing the first', () => {
    expect(() => readIndexStatus(row() + row('6 October 2026'), now)).toThrow('conflicting')
  })

  it.each(['31 September 2026', '5 Invalid 2026', '14 October 2026'])('rejects invalid or future date %s', (date) => {
    expect(() => readIndexStatus(row(date), now)).toThrow('date is invalid')
  })

  it('rejects mismatching display and link SHAs', () => {
    expect(() => readIndexStatus(row('5 October 2026', oldSha, mainSha.slice(0, 8)), now)).toThrow('inconsistent')
  })

  it.each([
    ['credentials', (html: string) => html.replace('github.com', 'user:password@github.com')],
    ['query', (html: string) => html.replace(`commits/${oldSha}`, `commits/${oldSha}?tracking=ignored`)],
    ['fragment', (html: string) => html.replace(`commits/${oldSha}`, `commits/${oldSha}#fragment`)],
  ])('rejects an index link with %s using the shared refresh validator', (_label, transform) => {
    expect(() => readIndexStatus(transform(row()), now)).toThrow('inconsistent')
  })

  it('does not combine unrelated index dates and commit links', () => {
    const html = `<main><div>Last indexed: 5 October 2026</div><section><a href="https://github.com/weapp-vite/weapp-vite/commits/${oldSha}">Other commit</a></section></main>`
    expect(() => readIndexStatus(html, now)).toThrow()
  })

  it('does not cross page sections even when the combined text resembles an index row', () => {
    const html = `<main><div>Last indexed: 5 October 2026 (</div><section><a href="https://github.com/weapp-vite/weapp-vite/commits/${oldSha}">${oldSha.slice(0, 8)}</a>)</section></main>`
    expect(() => readIndexStatus(html, now)).toThrow('readable index row')
  })

  it('ignores script, template and foreign repository metadata', () => {
    const html = `<script>${row()}</script><template>${row()}</template>${row().replaceAll('/weapp-vite/weapp-vite/', '/other/project/')}`
    expect(() => readIndexStatus(html, now)).toThrow('readable index row')
  })

  it.each([
    ['current', '1 October 2026', mainSha.slice(0, 8)],
    ['pending', '6 October 2026', oldSha],
    ['stale', '5 October 2026', oldSha],
  ])('reports %s with the 7/8-day boundary', async (status, date, sha) => {
    const fetchImpl = vi.fn().mockResolvedValue(response(row(date, sha)))
    const result = await monitorDeepWiki({ mainSha, now, fetchImpl })
    expect(result.status).toBe(status)
    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(deepWikiUrl, expect.objectContaining({ method: 'GET', redirect: 'error', signal: expect.any(AbortSignal) }))
    expect(fetchImpl.mock.calls[0][1]).not.toHaveProperty('body')
  })

  it('normalizes main SHA before comparing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(row('5 October 2026', mainSha.slice(0, 8))))
    expect((await monitorDeepWiki({ mainSha: ` ${mainSha.toUpperCase()} `, now, fetchImpl })).status).toBe('current')
  })

  it.each([undefined, '', 'abcdef1', 'g'.repeat(40)])('rejects invalid main SHA %s before fetching', async (invalidSha) => {
    const fetchImpl = vi.fn()
    expect((await monitorDeepWiki({ mainSha: invalidSha, now, fetchImpl })).status).toBe('unavailable')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([403, 429, 503])('reports HTTP %s as unavailable', async (status) => {
    const fetchImpl = vi.fn().mockResolvedValue(response(row(), status))
    expect(await monitorDeepWiki({ mainSha, now, fetchImpl })).toMatchObject({ status: 'unavailable', httpStatus: status })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('reports a Vercel challenge header even on HTTP 200', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(row(), 200, { 'x-vercel-mitigated': 'challenge' }))
    expect(await monitorDeepWiki({ mainSha, now, fetchImpl })).toMatchObject({ status: 'unavailable', reason: expect.stringContaining('security checkpoint') })
  })

  it.each(['Vercel Security Checkpoint', 'Sign in', 'Access denied'])('rejects restricted page title %s', async (title) => {
    const fetchImpl = vi.fn().mockResolvedValue(response(`<title>${title}</title>${row()}`))
    expect((await monitorDeepWiki({ mainSha, now, fetchImpl })).status).toBe('unavailable')
  })

  it('reports missing server-rendered index data as unavailable', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response('<title>DeepWiki</title><div id="app"></div>'))
    expect((await monitorDeepWiki({ mainSha, now, fetchImpl })).status).toBe('unavailable')
  })

  it('does not leak arbitrary network errors into reports or retry requests', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('private@example.test?token=secret'))
    const result = await monitorDeepWiki({ mainSha, now, fetchImpl })
    expect(result).toMatchObject({ status: 'unavailable', reason: 'Unable to fetch the public DeepWiki page' })
    expect(formatSummary(result)).not.toContain('private@example.test')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('bounds the complete response read with a timeout', async () => {
    const fetchImpl = vi.fn().mockImplementation(async (_url, { signal }) => {
      const page = response()
      vi.spyOn(page, 'text').mockImplementation(() => new Promise((_resolve, reject) => {
        if (signal.aborted) {
          reject(signal.reason)
        }
        else {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true })
        }
      }))
      return page
    })
    const result = await monitorDeepWiki({ mainSha, now, fetchImpl, timeoutMs: 10 })
    expect(result).toMatchObject({ status: 'unavailable', httpStatus: 200, reason: 'The public DeepWiki request timed out' })
    expect(fetchImpl.mock.calls[0][1].signal.aborted).toBe(true)
  })

  it('explains that an unavailable check is not evidence of a stale wiki', () => {
    expect(formatSummary({ status: 'unavailable' })).toContain('freshness could not be determined')
  })

  it('points stale-index reminders to the official badge refresh and manual flow', () => {
    const summary = formatSummary({ status: 'stale', indexedSha: oldSha, indexedDate: '5 October 2026', ageDays: 8 })
    expect(summary).toContain('at least 8 days old')
    expect(summary).toContain('https://github.com/CognitionAI/deepwiki#readme-badge')
    expect(summary).toContain('never submits a refresh request')
  })
})
