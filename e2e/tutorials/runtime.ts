import type { TutorialRuntimeProvider } from './config'
import fs from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

async function poll<T>(read: () => Promise<T>, accept: (value: T) => boolean, timeoutMs = 15_000) {
  const startedAt = Date.now()
  let latest: T
  while (Date.now() - startedAt < timeoutMs) {
    latest = await read()
    if (accept(latest)) {
      return latest
    }
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  throw new Error(`Runtime assertion timed out; latest value: ${JSON.stringify(latest!)}`)
}

async function launchMiniProgram(projectPath: string, provider: TutorialRuntimeProvider) {
  if (provider === 'headless') {
    const { launchHeadlessAutomator } = await import('../utils/automator.headless')
    return await launchHeadlessAutomator({ projectPath })
  }

  process.env.WEAPP_VITE_E2E_RUNTIME_PROVIDER = provider
  const { launchAutomator } = await import('../utils/automator')
  return await launchAutomator({ projectPath })
}

async function closeMiniProgram(miniProgram: any) {
  if (typeof miniProgram?.close === 'function') {
    await miniProgram.close()
    return
  }
  if (typeof miniProgram?.disconnect === 'function') {
    await miniProgram.disconnect()
  }
}

export async function assertHandbookRuntime(
  projectPath: string,
  provider: TutorialRuntimeProvider,
) {
  const miniProgram = await launchMiniProgram(projectPath, provider)
  try {
    const page = await miniProgram.reLaunch('/pages/index/index')
    const initial = await page.data()
    if (initial.count !== 0 || initial.doubled !== 0) {
      throw new Error(`Unexpected handbook initial state: ${JSON.stringify(initial)}`)
    }
    const button = await page.$('#increment-button')
    if (!button) {
      throw new Error('Handbook increment button was not rendered')
    }
    await button.tap()
    await poll(
      async () => {
        const data = await page.data()
        return { count: data.count, doubled: data.doubled }
      },
      value => value.count === 1 && value.doubled === 2,
    )
  }
  finally {
    await closeMiniProgram(miniProgram)
  }
}

export async function assertMultiPlatformRuntime(
  projectPath: string,
  provider: TutorialRuntimeProvider,
  sfc: boolean,
) {
  const miniProgram = await launchMiniProgram(projectPath, provider)
  try {
    const page = await miniProgram.reLaunch('/pages/index/index')
    const initial = await page.data()
    if (initial.platform !== 'weapp' || initial.status !== 'ready' || initial.count !== 0) {
      throw new Error(`Unexpected multi-platform initial state: ${JSON.stringify(initial)}`)
    }
    if (sfc && initial.doubled !== 0) {
      throw new Error(`Unexpected SFC doubled value: ${JSON.stringify(initial)}`)
    }
    const button = await page.$('#increment-button')
    if (!button) {
      throw new Error('Multi-platform increment button was not rendered')
    }
    await button.tap()
    await poll(
      async () => {
        const data = await page.data()
        return { count: data.count, doubled: data.doubled }
      },
      value => value.count === 1 && (!sfc || value.doubled === 2),
    )
  }
  finally {
    await closeMiniProgram(miniProgram)
  }
}

async function startStaticServer(root: string) {
  const resolvedRoot = path.resolve(root)
  const server = createServer(async (request, response) => {
    try {
      const requestPath = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname)
      const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '')
      const candidate = path.resolve(resolvedRoot, relativePath)
      const safeCandidate = candidate === resolvedRoot || candidate.startsWith(`${resolvedRoot}${path.sep}`)
        ? candidate
        : path.join(resolvedRoot, 'index.html')
      let filePath = safeCandidate
      try {
        const stat = await fs.stat(filePath)
        if (stat.isDirectory()) {
          filePath = path.join(filePath, 'index.html')
        }
      }
      catch {
        filePath = path.join(resolvedRoot, 'index.html')
      }
      const content = await fs.readFile(filePath)
      response.writeHead(200, {
        'content-type': CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
      })
      response.end(content)
    }
    catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      response.end(error instanceof Error ? error.message : String(error))
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('Failed to resolve tutorial Web server port')
  }
  return {
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve())
    }),
    url: `http://127.0.0.1:${address.port}`,
  }
}

export async function assertMultiPlatformWebRuntime(distRoot: string, sfc: boolean) {
  const server = await startStaticServer(distRoot)
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))

  try {
    await page.goto(server.url, { waitUntil: 'networkidle' })
    await poll(
      () => page.locator('#platform-marker').textContent(),
      value => value?.includes('MP_PLATFORM=web') === true,
      30_000,
    )
    await poll(
      () => page.locator('#runtime-status').textContent(),
      value => value?.includes('status=ready') === true,
    )
    await poll(
      () => page.locator('#counter-value').textContent(),
      value => value?.trim() === '0',
    )
    await page.locator('#increment-button').click()
    await poll(
      () => page.locator('#counter-value').textContent(),
      value => value?.trim() === '1',
    )
    if (sfc) {
      await poll(
        () => page.locator('#counter-doubled').textContent(),
        value => value?.includes('doubled=2') === true,
      )
    }
    if (pageErrors.length > 0) {
      throw new Error(`Web runtime page errors: ${pageErrors.join('; ')}`)
    }
  }
  finally {
    await page.close()
    await context.close()
    await browser.close()
    await server.close()
  }
}
