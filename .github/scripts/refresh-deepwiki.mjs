import { appendFile } from 'node:fs/promises'
import process from 'node:process'

import { chromium } from 'playwright'

const deepWikiUrl = 'https://deepwiki.com/weapp-vite/weapp-vite'
const mainSha = process.env.MAIN_SHA?.trim().toLowerCase()
const minimumAgeDays = 8

if (!mainSha || !/^[0-9a-f]{40}$/.test(mainSha)) {
  throw new Error('MAIN_SHA must be a full Git commit SHA')
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

async function writeSummary(lines) {
  const summary = `${lines.join('\n')}\n`
  console.log(summary)

  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary)
  }
}

async function fail(message, details = []) {
  await writeSummary([
    '## DeepWiki refresh failed',
    '',
    `- Reason: ${message}`,
    ...details.map(detail => `- ${detail}`),
  ])
  throw new Error(message)
}

try {
  await page.goto(deepWikiUrl, { waitUntil: 'domcontentloaded' })
  await page.getByText(/Last indexed:/).first().waitFor({ timeout: 30_000 })

  const indexedText = (await page.getByText(/Last indexed:/).first().textContent()).trim()
  const indexedLink = page.locator('a[href*="github.com/weapp-vite/weapp-vite/commits/"]').first()
  const indexedHref = await indexedLink.getAttribute('href')
  const indexedSha = indexedHref?.match(/\/commits\/([0-9a-f]{7,40})/i)?.[1]?.toLowerCase()
  const indexedDateText = indexedText
    .slice(indexedText.indexOf(':') + 1, indexedText.lastIndexOf('('))
    .trim()
  const indexedAt = indexedDateText ? Date.parse(`${indexedDateText} UTC`) : Number.NaN

  if (!indexedSha || Number.isNaN(indexedAt)) {
    await fail('Unable to read the public DeepWiki index status', [
      `Page status: ${indexedText}`,
    ])
  }

  const ageDays = Math.floor((Date.now() - indexedAt) / 86_400_000)
  const indexMatchesMain = mainSha.startsWith(indexedSha)
    || indexedSha.startsWith(mainSha)

  if (indexMatchesMain) {
    await writeSummary([
      '## DeepWiki is already current',
      '',
      `- main: \`${mainSha}\``,
      `- DeepWiki: \`${indexedSha}\` (${indexedDateText})`,
      '- Result: no refresh was requested.',
    ])
    process.exitCode = 0
  }
  else if (ageDays < minimumAgeDays) {
    await writeSummary([
      '## DeepWiki refresh is not due yet',
      '',
      `- main: \`${mainSha}\``,
      `- DeepWiki: \`${indexedSha}\` (${indexedDateText})`,
      `- Index age: ${ageDays} day(s); refresh starts at ${minimumAgeDays} days.`,
      '- Result: no refresh was requested.',
    ])
    process.exitCode = 0
  }
  else {
    const refreshName = /^Refresh(?: this wiki)?$/i
    const refreshButton = page.getByRole('button', { name: refreshName })
    const refreshLink = page.getByRole('link', { name: refreshName })
    const refreshControl = await refreshButton.count() > 0 ? refreshButton.first() : refreshLink.first()

    if (await refreshControl.count() === 0) {
      const bodyText = await page.locator('body').textContent()
      const blockedByLogin = /sign in|log in/i.test(bodyText)
      const blockedByCaptcha = /captcha|verify you are human/i.test(bodyText)
      const blockedByCooldown = /wait\s+\d+\s+days?\s+to\s+refresh/i.test(bodyText)
      const reason = blockedByLogin
        ? 'DeepWiki requires login before refresh'
        : blockedByCaptcha
          ? 'DeepWiki requires CAPTCHA verification'
          : blockedByCooldown
            ? 'DeepWiki still reports an active refresh cooldown'
            : 'The official DeepWiki refresh control is unavailable'

      await fail(reason, [
        `main: \`${mainSha}\``,
        `DeepWiki: \`${indexedSha}\` (${indexedDateText})`,
      ])
    }

    await refreshControl.click()
    await page.waitForTimeout(3_000)

    const acceptedPattern = /recently refreshed|refresh(?:ing| request (?:was )?accepted)|queued|wait\s+\d+\s+days?\s+to\s+refresh/i
    const bodyText = await page.locator('body').textContent()

    if (!acceptedPattern.test(bodyText)) {
      const blockedByLogin = /sign in|log in/i.test(bodyText)
      const blockedByCaptcha = /captcha|verify you are human/i.test(bodyText)
      await fail(
        blockedByLogin
          ? 'DeepWiki requested login after using the refresh control'
          : blockedByCaptcha
            ? 'DeepWiki requested CAPTCHA verification after using the refresh control'
            : 'DeepWiki did not confirm that the refresh request was accepted',
        [
          `main: \`${mainSha}\``,
          `DeepWiki before refresh: \`${indexedSha}\` (${indexedDateText})`,
        ],
      )
    }

    await writeSummary([
      '## DeepWiki refresh accepted',
      '',
      `- main: \`${mainSha}\``,
      `- DeepWiki before refresh: \`${indexedSha}\` (${indexedDateText})`,
      '- Result: the public refresh control accepted the request.',
    ])
  }
}
finally {
  await browser.close()
}
