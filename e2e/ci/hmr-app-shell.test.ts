import { setTimeout as sleep } from 'node:timers/promises'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/github-issues')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const APP_VUE_PATH = path.join(APP_ROOT, 'src/app.vue')
const APP_SHELL_WXML_DIST = path.join(DIST_ROOT, '__weapp_vite_app_shell.wxml')
const APP_SHELL_JSON_DIST = path.join(DIST_ROOT, '__weapp_vite_app_shell.json')
const APP_WXML_DIST = path.join(DIST_ROOT, 'app.wxml')
const PAGE_WXML_DIST = path.join(DIST_ROOT, 'pages/issue-338/index.wxml')
const PAGE_JSON_DIST = path.join(DIST_ROOT, 'pages/issue-338/index.json')
const INITIAL_APP_SHELL_MARKER = 'issue-563-app-shell'

async function waitForFileNotExists(filePath: string, timeoutMs = 90_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (!(await fs.pathExists(filePath))) {
      return
    }
    await sleep(250)
  }
  throw new Error(`Timed out waiting for ${filePath} to be absent`)
}

async function waitForPageUsingAppShell(timeoutMs = 90_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(PAGE_JSON_DIST)) {
      const pageJson = await fs.readJson(PAGE_JSON_DIST) as {
        usingComponents?: Record<string, string>
      }
      if (pageJson.usingComponents?.['weapp-app-shell'] === '/__weapp_vite_app_shell') {
        return pageJson
      }
    }
    await sleep(250)
  }
  throw new Error(`Timed out waiting for ${PAGE_JSON_DIST} to reference app shell`)
}

async function restoreAppVueSource(source: string) {
  await fs.writeFile(APP_VUE_PATH, source, 'utf8')
}

beforeEach(async () => {
  await cleanupResidualDevProcesses()
  await fs.remove(DIST_ROOT)
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

describe.sequential('app shell HMR (dev watch)', () => {
  it('updates app.vue template shell assets and keeps page wrappers in sync', async () => {
    const originalAppSource = await fs.readFile(APP_VUE_PATH, 'utf8')
    const updateMarker = createHmrMarker('APP-SHELL', 'weapp')
    const updatedAppSource = originalAppSource.replace(INITIAL_APP_SHELL_MARKER, updateMarker)

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      cwd: APP_ROOT,
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFileContains(APP_SHELL_WXML_DIST, INITIAL_APP_SHELL_MARKER), 'initial app shell emitted')
      await dev.waitFor(waitForFileContains(APP_SHELL_JSON_DIST, '"component": true'), 'initial app shell json emitted')
      await dev.waitFor(waitForFileNotExists(APP_WXML_DIST), 'app.wxml is not emitted for app shell')
      await dev.waitFor(waitForFileContains(PAGE_WXML_DIST, '<weapp-app-shell><weapp-layout-default>'), 'page wrapped with app shell and layout')
      await dev.waitFor(waitForPageUsingAppShell(), 'page json references app shell component')

      await sleep(1_000)
      await replaceFileByRename(APP_VUE_PATH, updatedAppSource)

      await dev.waitFor(waitForFileContains(APP_SHELL_WXML_DIST, updateMarker), 'app shell template updates after app.vue edit')
      await dev.waitFor(waitForFileContains(APP_SHELL_JSON_DIST, '"component": true'), 'app shell json remains a component after update')
      await dev.waitFor(waitForFileNotExists(APP_WXML_DIST), 'app.wxml remains absent after app.vue edit')
      await dev.waitFor(waitForFileContains(PAGE_WXML_DIST, '<weapp-app-shell><weapp-layout-default>'), 'page wrapper remains after app.vue edit')
      await dev.waitFor(waitForPageUsingAppShell(), 'page json keeps app shell component after app.vue edit')

      const pageWxml = await fs.readFile(PAGE_WXML_DIST, 'utf8')
      expect(pageWxml).toContain('</weapp-layout-default></weapp-app-shell>')
    }
    finally {
      await dev.stop(5_000)
      await restoreAppVueSource(originalAppSource)
    }
  })
})
