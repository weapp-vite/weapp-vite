import { acceptedText, assertPublicAccess, deepWikiUrl, isCooldown, minimumAgeDays, readIndexRow, refreshRestriction } from './state.mjs'

async function waitForState(page, read, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs
  do {
    await assertPublicAccess(page)
    const value = await read()
    if (value) {
      return value
    }
    await page.waitForTimeout(Math.min(100, Math.max(0, deadline - Date.now())))
  } while (Date.now() < deadline)
  throw new Error(message)
}

async function regionText(region) {
  return region.evaluate(element => element.textContent ?? '')
}

export async function refreshDeepWiki(page, { mainSha, email, dryRun = false, now = Date.now(), timeoutMs = 30_000 }) {
  const response = await page.goto(deepWikiUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
  await assertPublicAccess(page, response?.status())
  const status = await waitForState(page, () => readIndexRow(page, now), timeoutMs, 'Unable to read the public DeepWiki index status within the timeout')
  const result = {
    ...status,
    mainSha,
    index: { sha: status.indexedSha, dateText: status.indexedDateText, indexedAt: status.indexedAt },
  }
  const regionLocator = page.getByText('Refresh this wiki', { exact: true }).locator('..')
  await waitForState(page, async () => await regionLocator.count() === 1, timeoutMs, 'The official DeepWiki refresh region is unavailable')
  const region = await regionLocator.elementHandle()
  try {
    const initialText = await regionText(region)
    const restriction = refreshRestriction(initialText)
    if (restriction) {
      throw new Error(restriction)
    }
    if (mainSha.startsWith(status.indexedSha)) {
      return { ...result, status: 'current' }
    }
    if (status.ageDays < minimumAgeDays) {
      return { ...result, status: 'not-due' }
    }
    if (dryRun) {
      return { ...result, status: 'dry-run' }
    }
    if (isCooldown(initialText)) {
      return { ...result, status: 'cooldown' }
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(email)) {
      throw new Error('DEEPWIKI_REFRESH_EMAIL must contain a valid email address')
    }
    if (initialText.includes(acceptedText)) {
      throw new Error('DeepWiki already shows a refresh confirmation; a new request cannot be confirmed safely')
    }

    let submissionFailure
    const onConsole = (message) => {
      if (/Failed to refresh wiki:/i.test(message.text())) {
        submissionFailure ??= new Error('DeepWiki failed to refresh the wiki; the official form reported an error')
      }
    }
    const onResponse = (response) => {
      const url = new URL(response.url())
      if (response.request().method() === 'POST' && url.pathname === '/ada/index_public_repo' && !response.ok()) {
        submissionFailure = Object.assign(new Error(response.status() === 401
          ? 'DeepWiki requires login to refresh this wiki (HTTP 401)'
          : `DeepWiki rejected the refresh request (HTTP ${response.status()})`), { responseStatus: response.status() })
      }
    }
    page.on('console', onConsole)
    page.on('response', onResponse)
    try {
      const waitForControl = (control, message) => waitForState(page, async () => {
        const restriction = refreshRestriction(await regionText(region))
        if (restriction) {
          throw new Error(restriction)
        }
        return await control.count() === 1 && await control.isVisible() && await control.isEnabled()
      }, timeoutMs, message)
      const open = regionLocator.getByRole('button', { name: 'Enter email to refresh', exact: true })
      await waitForControl(open, 'The official Enter email to refresh button is unavailable')
      await open.click({ timeout: timeoutMs })
      const input = regionLocator.locator('input[type="email"]')
      await waitForControl(input, 'The official DeepWiki email input is unavailable')
      await input.fill(email, { timeout: timeoutMs })
      if (!await input.evaluate(element => element.checkValidity())) {
        throw new Error('The official DeepWiki form rejected the email address')
      }
      const submit = regionLocator.getByRole('button', { name: 'Start refresh', exact: true })
      await waitForControl(submit, 'The official Start refresh button did not become enabled')
      // 本次运行只点击一次；未确认或访问受限时不重试提交。
      await submit.click({ timeout: timeoutMs })
      await waitForState(page, async () => {
        if (submissionFailure) {
          throw submissionFailure
        }
        const text = await regionText(region)
        const restriction = refreshRestriction(text)
        if (restriction) {
          throw new Error(restriction)
        }
        if (isCooldown(text)) {
          throw new Error('DeepWiki rejected the refresh request with a cooldown response')
        }
        return text.includes(acceptedText)
      }, timeoutMs, 'DeepWiki did not confirm that the refresh request was accepted within the timeout')
      return { ...result, status: 'accepted' }
    }
    finally {
      page.off('console', onConsole)
      page.off('response', onResponse)
    }
  }
  finally {
    await region.dispose()
  }
}
