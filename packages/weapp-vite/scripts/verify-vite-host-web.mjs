import assert from 'node:assert/strict'
import { cp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { stripVTControlCharacters } from 'node:util'
// eslint-disable-next-line e18e/ban-dependencies -- 消费验证需要跨平台原生命令和完整进程清理。
import { execa } from 'execa'
import { chromium } from 'playwright'
import { createConsumerWebDiagnostics } from './consumerWebDiagnostics/index.mjs'
import { consumerWebWatcherDiagnosticSource } from './consumerWebDiagnostics/watcher.mjs'

async function waitFor(check, label, logs = () => '') {
  for (let attempt = 0; attempt < 300; attempt++) {
    if (await check()) {
      return
    }
    await delay(100)
  }
  throw new Error(`Timed out: ${label}\n${logs()}`)
}

async function closeChild(child, done) {
  if (child.pid && child.exitCode === undefined) {
    if (process.platform === 'win32') {
      await execa('taskkill', ['/PID', String(child.pid), '/T', '/F'], { reject: false })
    }
    else {
      const { stdout } = await execa('ps', ['-axo', 'pid=,ppid='])
      const processes = stdout.trim().split('\n').map(line => line.trim().split(/\s+/).map(Number))
      const owned = []
      const visit = (pid) => {
        for (const [candidate, parent] of processes) {
          if (parent === pid) {
            visit(candidate)
            owned.push(candidate)
          }
        }
      }
      visit(child.pid)
      for (const pid of [...owned, child.pid]) {
        try {
          process.kill(pid, 'SIGTERM')
        }
        catch (error) {
          if (error.code !== 'ESRCH') {
            throw error
          }
        }
      }
    }
  }
  assert(await Promise.race([done.then(() => true), delay(10_000, false, { ref: false })]), 'Web CLI must close its owned resources')
}

/** 用同一 SFC fixture 验证三种发布包入口的浏览器渲染、开发更新和原生构建。 */
export async function verifyWebConsumer(root, host, repoRoot) {
  const diagnostics = process.env.WEAPP_VITE_CONSUMER_WEB_DIAGNOSTICS === '1'
    ? createConsumerWebDiagnostics({ root, repoRoot, host })
    : undefined
  let failure
  let failed = false
  try {
    await verifyWebConsumerRuntime(root, host, repoRoot, diagnostics)
  }
  catch (error) {
    failure = error
    failed = true
    diagnostics?.fail(error)
  }
  try {
    await diagnostics?.save(failed ? 'failed' : 'passed')
  }
  catch (error) {
    if (!failed) {
      throw error
    }
    console.error('[web-consumer-diagnostic] Could not save diagnostics; original failure retained.')
  }
  if (failed) {
    throw failure
  }
}

async function verifyWebConsumerRuntime(root, host, repoRoot, diagnostics) {
  const fixture = path.join(repoRoot, 'templates/weapp-vite-multi-platform-sfc-template')
  for (const file of ['src', 'dist', 'project.config.json', 'project.private.config.json']) {
    await rm(path.join(root, file), { recursive: true, force: true })
  }
  for (const file of ['src', 'index.html', 'tsconfig.json']) {
    await cp(path.join(fixture, file), path.join(root, file), { recursive: true })
  }
  const require = createRequire(path.join(root, 'package.json'))
  const packageName = host === 'wv' ? 'weapp-vite' : host
  const cli = path.join(path.dirname(require.resolve(`${packageName}/package.json`)), host === 'wv' ? 'bin/weapp-vite.js' : host === 'vite-plus' ? 'bin/vp' : 'bin/vite.js')
  await writeFile(path.join(root, 'vite.config.mts'), `import { appendFileSync } from 'node:fs'
import { defineConfig } from '${packageName}'
${host === 'wv' ? '' : 'import { weapp } from \'weapp-vite/vite\''}
${diagnostics ? `${consumerWebWatcherDiagnosticSource}\n` : ''}appendFileSync(new URL('./config-calls.txt', import.meta.url), 'loaded\\n')
export default defineConfig({
  ${diagnostics ? `plugins: [${host === 'wv' ? '' : 'weapp(), '}...consumerWebWatcherDiagnostics()],` : host === 'wv' ? '' : 'plugins: [weapp()],'}
  server: { host: '127.0.0.1', port: 0, open: false },
  weapp: { platform: 'web', srcRoot: 'src', mcp: false },
})
`)
  await writeFile(path.join(root, 'config-calls.txt'), '')
  await execa(process.execPath, [cli, 'build'], { cwd: root, stdio: 'inherit' })
  assert.equal(await readFile(path.join(root, 'config-calls.txt'), 'utf8'), 'loaded\n')
  assert.deepEqual(await readdir(path.join(root, 'dist')), ['web'])
  const { preview } = await import(pathToFileURL(require.resolve('vite')).href)
  const browser = await chromium.launch({ headless: true })
  async function checkPage(url) {
    const page = await browser.newPage()
    diagnostics?.observePage(page)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(url)
    await page.locator('#increment-button').waitFor()
    assert.match(await page.locator('#platform-marker').textContent(), /MP_PLATFORM=web/)
    await page.locator('#increment-button').click()
    await waitFor(async () => (await page.locator('#counter-value').textContent()).trim() === '1', 'counter click')
    assert.match(await page.locator('#counter-doubled').textContent(), /doubled=2/)
    assert.match(await page.locator('#component-platform').textContent(), /web/)
    assert.deepEqual(errors, [])
    return page
  }
  try {
    diagnostics?.setPhase('preview')
    const previewServer = await preview({ root, configFile: false, build: { outDir: 'dist/web' }, preview: { host: '127.0.0.1', port: 0 } })
    try {
      const page = await checkPage(previewServer.resolvedUrls.local[0])
      await page.close()
    }
    finally {
      await new Promise((resolve, reject) => previewServer.httpServer.close(error => error ? reject(error) : resolve()))
    }
    for (const operation of host === 'wv' ? ['dev'] : ['dev', 'build-watch']) {
      diagnostics?.setPhase(`${operation}:startup`)
      await writeFile(path.join(root, 'config-calls.txt'), '')
      let logs = ''
      const child = execa(process.execPath, [cli, ...(operation === 'dev' ? ['dev'] : ['build', '--watch']), '--logLevel', 'info'], { cwd: root, env: { BROWSER: 'none', WEAPP_WEB_OPEN: 'false' } })
      const done = child.catch(error => error)
      child.stdout.on('data', (chunk) => {
        logs += chunk
        diagnostics?.observeChild(chunk, 'stdout')
      })
      child.stderr.on('data', (chunk) => {
        logs += chunk
        diagnostics?.observeChild(chunk, 'stderr')
      })
      const source = path.join(root, 'src/pages/index/index.vue')
      const original = await readFile(source, 'utf8')
      try {
        if (operation === 'dev') {
          let url
          await waitFor(() => {
            url = stripVTControlCharacters(logs).match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0]
            return Boolean(url)
          }, 'dev URL', () => logs)
          const page = await checkPage(url)
          try {
            diagnostics?.setPhase('dev:update')
            const updated = original.replace('SFC 响应式交互检查', 'web-host-updated')
            const updateWrite = diagnostics?.startWrite('update', updated)
            await writeFile(source, updated)
            diagnostics?.finishWrite(updateWrite)
            await page.getByText('web-host-updated', { exact: true }).waitFor()
            diagnostics?.visible('updated')
            diagnostics?.setPhase('dev:restore')
            const restoreWrite = diagnostics?.startWrite('restore', original)
            await writeFile(source, original)
            diagnostics?.finishWrite(restoreWrite)
            await page.getByText('SFC 响应式交互检查', { exact: true }).waitFor()
            diagnostics?.visible('restored')
          }
          catch (error) {
            if (diagnostics) {
              diagnostics.fail(error, await readFile(source).catch(() => undefined))
            }
            throw error
          }
          finally { await page.close() }
        }
        else {
          await waitFor(() => logs.includes('built in'), 'first watch build', () => logs)
          await writeFile(source, original.replace('SFC 响应式交互检查', 'web-watch-updated'))
          await waitFor(async () => {
            const files = await readdir(path.join(root, 'dist/web'), { recursive: true })
            for (const file of files.filter(file => file.endsWith('.js'))) {
              if ((await readFile(path.join(root, 'dist/web', file), 'utf8').catch(() => '')).includes('web-watch-updated')) {
                return true
              }
            }
            return false
          }, 'watch emitted update', () => logs)
        }
        assert.equal(await readFile(path.join(root, 'config-calls.txt'), 'utf8'), 'loaded\n')
      }
      catch (error) {
        if (diagnostics) {
          diagnostics.fail(error, await readFile(source).catch(() => undefined))
        }
        throw error
      }
      finally {
        await closeChild(child, done)
        await writeFile(source, original)
      }
    }
  }
  finally { await browser.close() }
  console.log(`${host}: strict packed Web build, browser counter/component and dev template update passed${host === 'wv' ? '' : ', including native build watch'}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [root, host, repoRoot] = process.argv.slice(2)
  assert(root && repoRoot && ['wv', 'vite', 'vite-plus'].includes(host), 'Expected consumer root, host and repository root')
  await verifyWebConsumer(root, host, repoRoot)
}
