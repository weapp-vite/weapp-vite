import { load } from 'cheerio'

export const deepWikiUrl = 'https://deepwiki.com/weapp-vite/weapp-vite'
export const minimumAgeDays = 8

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const indexPattern = /^Last indexed:\s*(\d{1,2})\s+([a-z]+)\s+(\d{4})\s*\(([0-9a-f]{6,40})\)$/i

function parseRow(text, sha, now) {
  const match = text.match(indexPattern)
  if (!match || !sha.startsWith(match[4].toLowerCase())) {
    throw new Error('The public DeepWiki index row has inconsistent date and SHA metadata')
  }
  const day = Number(match[1])
  const month = months.findIndex(value => value.toLowerCase() === match[2].toLowerCase())
  const year = Number(match[3])
  const indexedAt = Date.UTC(year, month, day)
  const date = new Date(indexedAt)
  if (month < 0 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day || indexedAt > now) {
    throw new Error('The public DeepWiki index date is invalid or in the future')
  }
  return { indexedSha: sha, indexedDate: `${day} ${months[month]} ${year}`, ageDays: Math.floor((now - indexedAt) / 86_400_000) }
}

export function readIndexStatus(html, now = Date.now()) {
  const $ = load(html)
  $('script, style, noscript, template').remove()
  const indexes = []
  for (const anchor of $('a[href]').toArray()) {
    const href = $(anchor).attr('href')
    let url
    try {
      url = new URL(href)
    }
    catch {
      continue
    }
    const sha = url.pathname.match(/^\/weapp-vite\/weapp-vite\/commits\/([0-9a-f]{7,40})\/?$/i)?.[1]?.toLowerCase()
    if (url.origin !== 'https://github.com' || !sha) {
      continue
    }
    let row = $(anchor).parent()
    while (row.length && !row.is('body, html, main, article, section, header, footer, nav, aside')) {
      const text = row.text().replace(/\s+/g, ' ').trim()
      if (text.startsWith('Last indexed:')) {
        // 只接受完整索引行，禁止从页面不同区域拼接日期和提交。
        if (row.find('a[href]').length === 1) {
          indexes.push(parseRow(text, sha, now))
        }
        break
      }
      row = row.parent()
    }
  }
  if (!indexes.length) {
    throw new Error('The public DeepWiki HTML does not contain a readable index row')
  }
  const distinct = new Set(indexes.map(index => `${index.indexedSha}:${index.indexedDate}`))
  if (distinct.size !== 1) {
    throw new Error('The public DeepWiki HTML contains conflicting index rows')
  }
  return indexes[0]
}

export async function monitorDeepWiki({ mainSha, fetchImpl = fetch, now = Date.now(), timeoutMs = 20_000 } = {}) {
  const normalizedSha = mainSha?.trim().toLowerCase()
  if (!normalizedSha || !/^[0-9a-f]{40}$/.test(normalizedSha)) {
    return { status: 'unavailable', reason: 'MAIN_SHA must be a full Git commit SHA' }
  }
  const result = { mainSha: normalizedSha, checkedAt: new Date(now).toISOString() }
  let response
  try {
    response = await fetchImpl(deepWikiUrl, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'accept': 'text/html', 'user-agent': 'weapp-vite-deepwiki-monitor' },
    })
    result.httpStatus = response.status
    if (response.headers.get('x-vercel-mitigated') === 'challenge') {
      return { ...result, status: 'unavailable', reason: 'DeepWiki security checkpoint blocked the read-only check' }
    }
    if (!response.ok) {
      return { ...result, status: 'unavailable', reason: `DeepWiki returned HTTP ${response.status}` }
    }
    const html = await response.text()
    const title = load(html)('title').text()
    if (/security checkpoint|access denied|just a moment|verify.*browser|sign in|log in/i.test(title)) {
      return { ...result, status: 'unavailable', reason: 'DeepWiki requires verification or login to read the public index' }
    }
    const index = readIndexStatus(html, now)
    const status = normalizedSha.startsWith(index.indexedSha) ? 'current' : index.ageDays >= minimumAgeDays ? 'stale' : 'pending'
    return { ...result, ...index, status }
  }
  catch (error) {
    let reason = 'Unable to fetch the public DeepWiki page'
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      reason = 'The public DeepWiki request timed out'
    }
    else if (response?.ok) {
      reason = error instanceof Error && error.message.startsWith('The public DeepWiki') ? error.message : 'Unable to read the public DeepWiki index'
    }
    return { ...result, status: 'unavailable', reason }
  }
}

export function formatSummary(result) {
  const lines = ['## DeepWiki index monitor', '', `- Status: ${result.status}`]
  if (result.mainSha) {
    lines.push(`- main: \`${result.mainSha}\``)
  }
  if (result.indexedSha) {
    lines.push(`- DeepWiki: \`${result.indexedSha}\` (${result.indexedDate}, ${result.ageDays} day(s) old)`)
  }
  if (result.httpStatus) {
    lines.push(`- Page HTTP status: ${result.httpStatus}`)
  }
  if (result.reason) {
    lines.push(`- Reason: ${result.reason}`)
  }
  if (result.status === 'stale') {
    lines.push('- The index differs from main and is at least 8 days old. Check the official automatic refresh or refresh manually.')
  }
  if (result.status === 'unavailable') {
    lines.push('- Index freshness could not be determined. This does not establish that the wiki is stale.')
  }
  lines.push('', `Updates use the README badge's [official automatic refresh](https://github.com/CognitionAI/deepwiki#readme-badge).`, `This check only reads [the public wiki](${deepWikiUrl}); it never submits a refresh request.`)
  return `${lines.join('\n')}\n`
}
