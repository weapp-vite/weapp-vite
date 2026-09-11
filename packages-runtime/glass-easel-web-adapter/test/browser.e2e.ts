import type { ViteDevServer } from 'vite'
import process from 'node:process'
import { chromium } from 'playwright'
import { createServer } from 'vite'

async function main() {
  const server: ViteDevServer = await createServer({
    root: process.cwd(),
    server: { port: 0, host: '127.0.0.1' },
  })
  await server.listen()

  const address = server.httpServer?.address()
  if (!address || typeof address === 'string') {
    throw new Error('browser E2E server did not bind')
  }

  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.goto(`http://127.0.0.1:${address.port}/test/browser-fixture.html`)
    await page.waitForFunction(() => document.body.dataset.ready === 'true')
    const snapshot = await page.evaluate(() => JSON.parse(document.body.dataset.snapshot ?? '{}'))
    if (snapshot.props?.count !== 2 || snapshot.disposed !== false || !String(snapshot.html).includes('2')) {
      throw new Error(`unexpected browser snapshot: ${JSON.stringify(snapshot)}`)
    }
  }
  finally {
    await browser.close()
  }
  await server.close()
}

void main()
