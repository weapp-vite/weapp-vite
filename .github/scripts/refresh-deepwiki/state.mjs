const repositoryPath = '/weapp-vite/weapp-vite/commits/'
export const minimumAgeDays = 8
export const acceptedPattern = /recently refreshed|refresh(?:ing| request (?:was )?accepted)|queued|wait\s+\d+\s+days?\s+to\s+refresh/i

export function validateMainSha(value) {
  const sha = value?.trim().toLowerCase()
  if (!sha || !/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error('MAIN_SHA must be a full Git commit SHA')
  }
  return sha
}

export function parseIndexStatus({ text, href }, now = Date.now()) {
  const invalidStatus = () => new Error('The public DeepWiki index row has inconsistent date and SHA metadata')
  let url
  try {
    url = new URL(href)
  }
  catch {
    throw invalidStatus()
  }
  const sha = url.pathname.startsWith(repositoryPath) ? url.pathname.slice(repositoryPath.length).replace(/\/$/, '') : ''
  const row = text.trim().match(/^Last indexed:([^()]+)\(([0-9a-f]{6,40})\)$/i)
  const dateText = row?.[1]?.trim()
  const displayedSha = row?.[2]?.toLowerCase()
  const indexedAt = dateText ? Date.parse(`${dateText} UTC`) : Number.NaN
  const canonicalDate = Number.isNaN(indexedAt)
    ? undefined
    : new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(indexedAt))
  if (url.origin !== 'https://github.com' || url.username || url.password || url.search || url.hash
    || !/^[0-9a-f]{7,40}$/i.test(sha) || !displayedSha || !sha.toLowerCase().startsWith(displayedSha)) {
    throw invalidStatus()
  }
  if (canonicalDate?.toLowerCase() !== dateText?.toLowerCase() || indexedAt > now) {
    throw new Error('The public DeepWiki index date is invalid or in the future')
  }
  return { sha: sha.toLowerCase(), indexedAt, dateText }
}

export function refreshDecision(mainSha, index, now) {
  if (mainSha.startsWith(index.sha) || index.sha.startsWith(mainSha)) {
    return { status: 'current', reason: 'DeepWiki is already current' }
  }
  const ageDays = Math.floor((now - index.indexedAt) / 86_400_000)
  return ageDays < minimumAgeDays
    ? { status: 'not-due', reason: `Index age is ${ageDays} day(s); refresh starts at ${minimumAgeDays} days`, ageDays }
    : { status: 'due', ageDays }
}

export function identityGate(state) {
  const controls = state.controls ?? []
  const headings = state.headings ?? []
  if (/captcha|verify you are human/i.test(state.title ?? '')
    || headings.some(text => /captcha|verify you are human/i.test(text))
    || /complete (?:the |a )?captcha|verify you are human/i.test(state.bodyText ?? '')) {
    return { scope: 'page', kind: 'captcha', reason: 'DeepWiki requires CAPTCHA verification' }
  }
  if (/\/(?:login|signin)(?:[/?#]|$)/i.test(state.url ?? '')
    || /^(?:sign|log) in(?: to .+)?$/i.test(state.title ?? '')
    || headings.some(text => /^(?:sign|log) in(?: to .+)?$/i.test(text))) {
    return { scope: 'page', kind: 'login', reason: 'DeepWiki requires login before refresh' }
  }
  if (controls.some(text => /^Enter email to refresh$/i.test(text.trim()))) {
    return { scope: 'refresh', kind: 'email', reason: 'DeepWiki requires email identity before refresh' }
  }
  if (controls.some(text => /^(?:sign|log) in to refresh$/i.test(text.trim()))) {
    return { scope: 'refresh', kind: 'login', reason: 'DeepWiki requires login before refresh' }
  }
  return undefined
}
