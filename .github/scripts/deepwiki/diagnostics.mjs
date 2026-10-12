import { appendFile, mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'
import { refreshDeepWiki } from './index.mjs'

const EMAIL_RE = /[\w.%+-]+@[\w.-]+\.[a-z]{2,}/gi
const URL_RE = /https?:\/\/[^\s<>"'`]+/gi
const RELATIVE_URL_RE = /\/[^\s<>"'`?#]*[?#][^\s<>"'`]+/g
const SENSITIVE_KEY_PATTERN = ['recaptcha_token', 'email_to_notify']
  .map(key => Array.from(key, char => `(?:${char}|%${char.charCodeAt(0).toString(16)})`).join(''))
  .join('|')
const SENSITIVE_PARAMETER_RE = new RegExp(String.raw`(?:["']|%22|%27)?(?:${SENSITIVE_KEY_PATTERN})(?:["']|%22|%27)?(?:\s|%20)*(?:[:=]|%3[ad])(?:\s|%20)*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|%22(?:(?!%22).)*%22|%27(?:(?!%27).)*%27|[^\s&;,<>"'\]}]+)`, 'gi')
const MAIN_SHA_RE = /^[0-9a-f]{40}$/i
const SUMMARY_TITLES = {
  'current': 'DeepWiki is already current',
  'not-due': 'DeepWiki refresh is not due yet',
  'dry-run': 'DeepWiki refresh dry run',
  'accepted': 'DeepWiki refresh accepted',
  'cooldown': 'DeepWiki refresh cooldown is active',
  'failed': 'DeepWiki refresh failed',
}

export function redact(value, email = '') {
  let text = String(value ?? '')
  text = text.replace(URL_RE, (rawUrl) => {
    try {
      const url = new URL(rawUrl)
      return `${url.origin}${url.pathname}`
    }
    catch {
      return rawUrl.split(/[?#]/)[0]
    }
  })
  text = text.replace(SENSITIVE_PARAMETER_RE, '[redacted]')
  if (email) {
    for (const secret of [email, encodeURIComponent(email)]) {
      const escaped = secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      text = text.replace(new RegExp(escaped, 'gi'), '[redacted]')
    }
  }
  return text
    .replace(RELATIVE_URL_RE, relativeUrl => relativeUrl.split(/[?#]/)[0])
    .replace(EMAIL_RE, '[redacted]')
}

function safeUrl(value, email) {
  try {
    const url = new URL(value)
    return redact(`${url.origin}${url.pathname}`, email)
  }
  catch {
    return redact(String(value ?? '').split(/[?#]/)[0], email)
  }
}

function errorMessage(error, email) {
  return redact(error instanceof Error ? error.message : error, email)
}

function safeOutcome(result, email) {
  const indexedSha = result.index?.sha ?? result.indexedSha
  const indexedDateText = result.index?.dateText ?? result.indexedDateText
  return {
    status: result.status,
    ...(indexedSha ? { indexedSha: redact(indexedSha, email) } : {}),
    ...(indexedDateText ? { indexedDateText: redact(indexedDateText, email) } : {}),
    ...(Number.isFinite(result.ageDays) ? { ageDays: result.ageDays } : {}),
    ...(Number.isFinite(result.responseStatus) ? { responseStatus: result.responseStatus } : {}),
  }
}

function makeSummary(result, diagnostics) {
  const lines = [`## ${SUMMARY_TITLES[result.status] ?? SUMMARY_TITLES.failed}`, '', `- Status: ${result.status}`]
  if (diagnostics.mainSha) {
    lines.push(`- main: \`${diagnostics.mainSha}\``)
  }
  if (result.indexedSha) {
    lines.push(`- DeepWiki: \`${result.indexedSha}\` (${result.indexedDateText})`)
  }
  if (Number.isFinite(result.ageDays)) {
    lines.push(`- Index age: ${result.ageDays} day(s); refresh starts at 8 days.`)
  }
  if (Number.isFinite(diagnostics.navigation.status)) {
    lines.push(`- Page HTTP status: ${diagnostics.navigation.status}`)
  }
  if (Number.isFinite(result.responseStatus)) {
    lines.push(`- Official refresh response HTTP status: ${result.responseStatus}`)
  }
  if (result.code) {
    lines.push(`- Error code: ${result.code}`)
  }
  if (result.reason) {
    lines.push(`- Reason: ${result.reason}`)
  }
  return `${lines.join('\n')}\n`
}

async function saveFailureScreenshot(page, target, email) {
  const mask = [
    page.locator('input, textarea, iframe, form, [role="dialog"]'),
    page.getByText(/^Refresh this wiki$/i).locator('..'),
    page.locator('[role="alert"], [role="status"], [aria-live], [data-sonner-toaster], [class*="toast"]'),
    page.getByText(EMAIL_RE),
    page.getByText(/recaptcha_token|email_to_notify/i),
  ]
  if (email) {
    mask.push(page.getByText(email, { exact: false }))
    mask.push(page.getByText(encodeURIComponent(email), { exact: false }))
  }
  await page.screenshot({ path: target, mask, fullPage: false })
}

export async function runDeepWikiRefresh({
  env = process.env,
  launch = () => chromium.launch({ headless: true }),
  output = console.log,
  diagnosticsDir = '.tmp/deepwiki-refresh',
  timeoutMs = 30_000,
} = {}) {
  const email = env.DEEPWIKI_REFRESH_EMAIL?.trim() ?? ''
  const diagnostics = { navigation: {}, recentEvents: [], diagnosticErrors: [] }
  let browser
  let page
  let result
  let firstFailure
  let firstFailureCode
  let firstFailureResponseStatus
  let screenshotSaved = false
  const recordFailure = (error) => {
    const reason = errorMessage(error, email)
    if (firstFailure === undefined) {
      firstFailure = reason
      firstFailureCode = error?.code ? redact(error.code, email) : undefined
      firstFailureResponseStatus = Number.isFinite(error?.responseStatus) ? error.responseStatus : undefined
    }
    else {
      diagnostics.diagnosticErrors.push(reason)
    }
  }
  const failedResult = () => ({
    status: 'failed',
    reason: firstFailure,
    ...(firstFailureCode ? { code: firstFailureCode } : {}),
    ...(firstFailureResponseStatus !== undefined ? { responseStatus: firstFailureResponseStatus } : {}),
  })
  const recordEvent = (event) => {
    diagnostics.recentEvents.push(event)
    if (diagnostics.recentEvents.length > 10) {
      diagnostics.recentEvents.shift()
    }
  }
  const observe = callback => (...args) => {
    try {
      callback(...args)
    }
    catch (error) {
      diagnostics.diagnosticErrors.push(errorMessage(error, email))
    }
  }
  const captureFailure = async () => {
    if (!page || screenshotSaved) {
      return
    }
    try {
      await saveFailureScreenshot(page, path.join(diagnosticsDir, 'page.png'), email)
      screenshotSaved = true
    }
    catch (error) {
      diagnostics.diagnosticErrors.push(errorMessage(error, email))
    }
  }

  try {
    await mkdir(diagnosticsDir, { recursive: true })
    await rm(path.join(diagnosticsDir, 'page.png'), { force: true })
    const mainSha = env.MAIN_SHA?.trim().toLowerCase()
    if (!mainSha || !MAIN_SHA_RE.test(mainSha)) {
      throw new Error('MAIN_SHA must be a full Git commit SHA')
    }
    const rawDryRun = env.DRY_RUN ?? 'false'
    if (rawDryRun !== 'true' && rawDryRun !== 'false') {
      throw new Error('DRY_RUN must be true or false')
    }
    diagnostics.mainSha = mainSha
    diagnostics.dryRun = rawDryRun === 'true'
    browser = await launch()
    page = await browser.newPage()
    page.on('console', observe((message) => {
      recordEvent({ type: 'console', message: redact(message.text(), email) })
    }))
    page.on('requestfailed', observe((request) => {
      recordEvent({ type: 'requestfailed', url: safeUrl(request.url(), email), message: redact(request.failure()?.errorText ?? 'Request failed', email) })
    }))
    page.on('response', observe((response) => {
      const request = response.request()
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        diagnostics.navigation = {
          status: response.status(),
          url: safeUrl(response.url(), email),
          vercelMitigated: redact(response.headers()['x-vercel-mitigated'] ?? '', email),
        }
      }
      else {
        const url = new URL(response.url())
        if (request.method() === 'POST' && url.protocol === 'https:' && url.pathname === '/ada/index_public_repo') {
          diagnostics.refreshResponse = { status: response.status(), url: safeUrl(response.url(), email) }
        }
      }
    }))
    result = safeOutcome(await refreshDeepWiki(page, {
      mainSha,
      email,
      dryRun: diagnostics.dryRun,
      now: Date.now(),
      timeoutMs,
    }), email)
  }
  catch (error) {
    recordFailure(error)
  }
  if (page) {
    try {
      const indexLabel = page.getByText(/Last indexed:/)
      const labelCount = await indexLabel.count()
      diagnostics.indexProbe = {
        labelCount,
        firstLabelVisible: labelCount > 0 && await indexLabel.first().isVisible(),
        commitLinkCount: await page.locator('a[href*="github.com/weapp-vite/weapp-vite/commits/"]').count(),
      }
    }
    catch (error) {
      diagnostics.diagnosticErrors.push(errorMessage(error, email))
    }
    try {
      diagnostics.navigation.url = safeUrl(page.url(), email)
      diagnostics.navigation.title = redact(await page.title(), email)
    }
    catch (error) {
      diagnostics.diagnosticErrors.push(errorMessage(error, email))
    }
    if (firstFailure !== undefined) {
      await captureFailure()
    }
  }
  if (browser) {
    try {
      await browser.close()
    }
    catch (error) {
      recordFailure(error)
      await captureFailure()
    }
  }
  if (firstFailure !== undefined) {
    result = failedResult()
  }
  try {
    if (env.GITHUB_STEP_SUMMARY) {
      await appendFile(env.GITHUB_STEP_SUMMARY, makeSummary(result, diagnostics))
    }
  }
  catch (error) {
    recordFailure(error)
    result = failedResult()
  }
  try {
    await writeFile(path.join(diagnosticsDir, 'diagnostics.json'), `${JSON.stringify({ ...diagnostics, result }, null, 2)}\n`)
  }
  catch (error) {
    recordFailure(error)
    result = failedResult()
  }
  try {
    await output(redact(makeSummary(result, diagnostics), email))
  }
  catch (error) {
    recordFailure(error)
    result = failedResult()
  }
  return result
}
