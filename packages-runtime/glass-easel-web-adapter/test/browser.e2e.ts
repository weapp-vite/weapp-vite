import type { GlassEaselWebSnapshot } from '@weapp-vite/glass-easel-web-adapter'
import type { Browser } from 'playwright'
import type { ViteDevServer } from 'vite'
import assert from 'node:assert/strict'
import process from 'node:process'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { withMachineE2ELease } from '../../../packages/devtools-runtime/src/lease/machine'

interface BrowserFixtureSnapshot {
  first: GlassEaselWebSnapshot
  second: GlassEaselWebSnapshot
  lifecycle: string[]
  sentinelPreserved: boolean
  firstMounted: boolean
  secondMounted: boolean
  rowOrder: string[]
}

declare global {
  interface Window {
    glassEaselFixture: {
      snapshot: () => BrowserFixtureSnapshot
      update: () => void
      reorder: () => boolean
      unmountFirst: () => void
      dispose: () => void
    }
  }
}

async function main() {
  let server: ViteDevServer | undefined
  let browser: Browser | undefined
  let failure: { error: unknown } | undefined
  let cleanupErrors: unknown[] = []
  const diagnostics: string[] = []
  const browserErrors: string[] = []
  try {
    server = await createServer({
      root: process.cwd(),
      server: { port: 0, host: '127.0.0.1' },
    })
    await server.listen()
    const address = server.httpServer?.address()
    if (!address || typeof address === 'string') {
      throw new Error('browser E2E server did not bind')
    }

    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    page.on('console', (message) => {
      diagnostics.push(`console.${message.type()}: ${message.text()}`)
      if (message.type() === 'error') {
        browserErrors.push(message.text())
      }
    })
    page.on('pageerror', (error) => {
      diagnostics.push(`pageerror: ${error.message}`)
      browserErrors.push(error.message)
    })
    await page.goto(`http://127.0.0.1:${address.port}/test/browser-fixture.html`)
    await page.waitForFunction(() => document.body.dataset.ready === 'true')

    const initial = await page.evaluate(() => window.glassEaselFixture.snapshot())
    assert.equal(initial.sentinelPreserved, true)
    assert.equal(initial.firstMounted, true)
    assert.equal(initial.secondMounted, true)
    assert.deepEqual(initial.first.lifecycle, ['created', 'attached'])
    assert.deepEqual(initial.second.lifecycle, ['created', 'attached'])
    assert.equal(await page.locator('#first-root header #heading').textContent(), 'Initial title')
    assert.equal(await page.locator('#first-root main #slot-action').textContent(), 'Clicks: 0')

    await page.locator('#first-root #slot-action').click()
    await page.locator('#first-root #child-action').click()
    const clicked = await page.evaluate(() => window.glassEaselFixture.snapshot())
    assert.equal(clicked.first.props.clicks, 1)
    assert.equal(clicked.first.props.childChanges, 1)
    assert.equal(clicked.first.props.lastChild, 'Initial title')
    assert.equal(clicked.second.props.clicks, 0)
    assert.equal(clicked.second.props.childChanges, 0)

    await page.evaluate(() => window.glassEaselFixture.update())
    assert.equal(await page.locator('#first-root header #heading').textContent(), 'Updated title')
    assert.equal(await page.locator('#first-root #child-action').textContent(), 'Updated title')
    await page.locator('#first-root #slot-action').click()
    await page.locator('#first-root #child-action').click()
    const updated = await page.evaluate(() => window.glassEaselFixture.snapshot())
    assert.equal(updated.first.props.clicks, 2)
    assert.equal(updated.first.props.childChanges, 2)
    assert.equal(updated.first.props.lastChild, 'Updated title')

    assert.equal(await page.evaluate(() => window.glassEaselFixture.reorder()), true)
    const reordered = await page.evaluate(() => window.glassEaselFixture.snapshot())
    assert.deepEqual(reordered.rowOrder, ['b', 'a'])
    assert.deepEqual(await page.locator('#first-root li').allTextContents(), ['Beta updated', 'Alpha updated'])

    await page.evaluate(() => window.glassEaselFixture.unmountFirst())
    const unmounted = await page.evaluate(() => window.glassEaselFixture.snapshot())
    assert.equal(unmounted.first.disposed, true)
    assert.equal(unmounted.firstMounted, false)
    assert.equal(unmounted.secondMounted, true)
    assert.equal(unmounted.sentinelPreserved, true)
    assert.deepEqual(unmounted.first.lifecycle, ['created', 'attached', 'detached'])
    assert.equal(unmounted.lifecycle.filter(value => value === 'child:detached').length, 1)
    await page.locator('#second-root #slot-action').click()
    assert.equal((await page.evaluate(() => window.glassEaselFixture.snapshot())).second.props.clicks, 1)

    await page.evaluate(() => window.glassEaselFixture.dispose())
    const disposed = await page.evaluate(() => window.glassEaselFixture.snapshot())
    assert.equal(disposed.second.disposed, true)
    assert.equal(disposed.secondMounted, false)
    assert.equal(disposed.sentinelPreserved, true)
    assert.deepEqual(disposed.second.lifecycle, ['created', 'attached', 'detached'])
    for (const name of ['parent', 'child']) {
      for (const lifetime of ['created', 'attached', 'detached']) {
        assert.equal(disposed.lifecycle.filter(value => value === `${name}:${lifetime}`).length, 2)
      }
    }
    assert.deepEqual(browserErrors, [])
    process.stdout.write('glass-easel browser: component tree, slots, events, keyed updates and teardown passed\n')
  }
  catch (error) {
    failure = { error }
    if (diagnostics.length) {
      process.stderr.write(`${diagnostics.join('\n')}\n`)
    }
  }
  finally {
    const cleanup = await Promise.allSettled([browser?.close(), server?.close()])
    cleanupErrors = cleanup.filter(result => result.status === 'rejected').map(result => result.reason as unknown)
  }
  if (cleanupErrors.length) {
    throw new AggregateError(failure ? [failure.error, ...cleanupErrors] : cleanupErrors, 'Browser E2E cleanup did not complete.')
  }
  if (failure) {
    throw failure.error
  }
}

void withMachineE2ELease(main)
