export const deepWikiUrl = 'https://deepwiki.com/weapp-vite/weapp-vite'
export const acceptedText = 'Refresh started! We\'ll email you when the refresh completes.'
export const minimumAgeDays = 8

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function parseIndexStatus({ text, href }, now = Date.now()) {
  const match = text?.match(/Last indexed:\s*(\d{1,2})\s+([A-Z]+)\s+(\d{4})\s*\(([0-9a-f]{6,40})\)/i)
  const url = new URL(href)
  const indexedSha = url.pathname.match(/^\/weapp-vite\/weapp-vite\/commits\/([0-9a-f]{7,40})\/?$/i)?.[1]?.toLowerCase()
  if (!match || url.origin !== 'https://github.com' || !indexedSha || !indexedSha.startsWith(match[4].toLowerCase())) {
    throw new Error('Unable to read the date and SHA from the same public DeepWiki index row')
  }
  const day = Number(match[1])
  const month = months.findIndex(value => value.toLowerCase() === match[2].toLowerCase())
  const year = Number(match[3])
  const indexedAt = Date.UTC(year, month, day)
  const date = new Date(indexedAt)
  if (month < 0 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day || indexedAt > now) {
    throw new Error('The public DeepWiki index date is invalid or in the future')
  }
  return {
    indexedSha,
    indexedDateText: `${day} ${months[month]} ${year}`,
    indexedAt,
    ageDays: Math.floor((now - indexedAt) / 86_400_000),
  }
}

export async function readIndexRow(page, now) {
  const rows = await page.locator('a[href*="github.com/weapp-vite/weapp-vite/commits/"]').evaluateAll((links) => {
    const rows = []
    for (const link of links) {
      let element = link.parentElement
      while (element && element.tagName !== 'BODY') {
        const text = element.textContent ?? ''
        if (/Last indexed:/i.test(text)) {
          rows.push({ text, href: link.href })
          break
        }
        element = element.parentElement
      }
    }
    return rows
  })
  for (const row of rows) {
    try {
      return parseIndexStatus(row, now)
    }
    catch {
      // 其他提交链接不能替代索引行中的日期与 SHA。
    }
  }
  return undefined
}

export function refreshRestriction(text) {
  if (/sign in|log in|login required/i.test(text)) {
    return 'DeepWiki requires login to refresh this wiki'
  }
  if (/captcha|verify you are human|verification required/i.test(text)) {
    return 'DeepWiki requires CAPTCHA verification'
  }
  if (/failed to refresh|refresh failed|request failed/i.test(text)) {
    return 'DeepWiki rejected the refresh request'
  }
  return undefined
}

export function isCooldown(text) {
  return /wait\s+\d+\s+days?\s+to\s+refresh|recently refreshed/i.test(text)
}

export async function assertPublicAccess(page, responseStatus) {
  const title = await page.title()
  if (/security checkpoint|access denied|just a moment|verify.*browser/i.test(title)) {
    throw new Error(`DeepWiki security checkpoint blocked access${responseStatus ? ` (HTTP ${responseStatus})` : ''}`)
  }
  if (responseStatus >= 400) {
    throw new Error(`DeepWiki navigation failed (HTTP ${responseStatus})`)
  }
  const challenges = page.locator('iframe[src*="recaptcha"][src*="bframe"]:visible, iframe[title*="challenge" i]:visible')
  if (await challenges.count()) {
    throw new Error('DeepWiki requires CAPTCHA verification')
  }
  if (/\/(?:login|signin|sign-in)(?:\/|$)/i.test(new URL(page.url()).pathname) || /^(?:sign in|log in)/i.test(title)) {
    throw new Error('DeepWiki requires login to access the wiki')
  }
}
