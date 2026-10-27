import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { appendFile, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

/** 缓存只接受同平台、同安装版本与同浏览器 revision，不从候选内容推导宽松回退 key。 */
export function playwrightCacheIdentity({ platform, arch, version, definitions, browsers, home, localAppData }) {
  const selected = [...new Set(browsers.trim().split(/\s+/u))].sort()
  assert(selected.length && selected.every(browser => ['chromium', 'firefox', 'webkit'].includes(browser)), 'Unsupported cached Playwright browser')
  assert(typeof version === 'string' && version && Array.isArray(definitions.browsers), 'Invalid Playwright revision inventory')
  const revisions = definitions.browsers.filter(browser => selected.some(name => browser.name === name || browser.name.startsWith(`${name}-`)))
  assert(selected.every(name => revisions.some(browser => browser.name === name)), 'Missing Playwright browser revision')
  const identity = { platform, arch, version, selected, revisions }
  const digest = createHash('sha256').update(JSON.stringify(identity)).digest('hex')
  const directory = platform === 'win32'
    ? path.join(localAppData || path.join(home, 'AppData', 'Local'), 'ms-playwright')
    : path.join(home, platform === 'darwin' ? 'Library/Caches' : '.cache', 'ms-playwright')
  return { key: `playwright-${platform}-${arch}-${digest}`, directory }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const require = createRequire(import.meta.url)
  const playwrightRequire = createRequire(require.resolve('playwright/package.json'))
  const manifestPath = playwrightRequire.resolve('playwright-core/package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const definitions = JSON.parse(await readFile(path.join(path.dirname(manifestPath), 'browsers.json'), 'utf8'))
  const identity = playwrightCacheIdentity({ platform: process.platform, arch: process.arch, version: manifest.version, definitions, browsers: process.argv[2] || 'chromium', home: os.homedir(), localAppData: process.env.LOCALAPPDATA })
  assert(process.env.GITHUB_OUTPUT && !/[\r\n]/u.test(identity.directory), 'Invalid Playwright cache output')
  await appendFile(process.env.GITHUB_OUTPUT, `key=${identity.key}\npath=${identity.directory}\n`)
}
