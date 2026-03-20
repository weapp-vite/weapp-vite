import { setTimeout as sleep } from 'node:timers/promises'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/auto-routes-define-app-json')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const TYPED_ROUTER_PATH = path.join(APP_ROOT, '.weapp-vite/typed-router.d.ts')

const LOGS_VUE_PATH = path.join(APP_ROOT, 'src/pages/logs/index.vue')
const ADDED_ROUTE_VUE_PATH = path.join(APP_ROOT, 'src/pages/logs/hmr-added.vue')
const APP_VUE_PATH = path.join(APP_ROOT, 'src/app.vue')
const MARKETING_CAMPAIGN_ROUTE = 'subpackages/marketing/pages/campaign/index'
const LOGS_ROUTE = 'pages/logs/index'
const ADDED_ROUTE = 'pages/logs/hmr-added'
const LOGS_WXML_DIST = path.join(DIST_ROOT, `${LOGS_ROUTE}.wxml`)
const ADDED_ROUTE_WXML_DIST = path.join(DIST_ROOT, `${ADDED_ROUTE}.wxml`)
const APP_JSON_DIST = path.join(DIST_ROOT, 'app.json')
const APP_JS_DIST = path.join(DIST_ROOT, 'app.js')
const BASE_APP_TITLE = 'auto-routes-define-app-json'

async function restoreAutoRoutesSources() {
  if (await fs.pathExists(LOGS_VUE_PATH)) {
    const logsSource = await fs.readFile(LOGS_VUE_PATH, 'utf8')
    const normalizedLogsSource = logsSource.replace(/page-HMR-[A-Z0-9-]+/g, 'page-logs')
    if (normalizedLogsSource !== logsSource) {
      await fs.writeFile(LOGS_VUE_PATH, normalizedLogsSource, 'utf8')
    }
  }

  if (await fs.pathExists(APP_VUE_PATH)) {
    const appSource = await fs.readFile(APP_VUE_PATH, 'utf8')
    const normalizedAppSource = appSource.replace(
      /navigationBarTitleText: 'HMR-[A-Z0-9-]+'/g,
      `navigationBarTitleText: '${BASE_APP_TITLE}'`,
    )
    if (normalizedAppSource !== appSource) {
      await fs.writeFile(APP_VUE_PATH, normalizedAppSource, 'utf8')
    }
  }
}

async function waitForFile(filePath: string, timeoutMs = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(filePath)) {
      return
    }
    await sleep(250)
  }
  throw new Error(`Timed out waiting for file: ${filePath}`)
}

async function waitForFileNotContains(filePath: string, marker: string, timeoutMs = 90_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf8')
      if (!content.includes(marker)) {
        return content
      }
    }
    await sleep(250)
  }
  throw new Error(`Timed out waiting for ${filePath} to remove marker: ${marker}`)
}

async function waitForAppJsonPagesToContain(route: string, timeoutMs = 90_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(APP_JSON_DIST)) {
      const appJson = await fs.readJson(APP_JSON_DIST)
      if (Array.isArray(appJson?.pages) && appJson.pages.includes(route)) {
        return appJson
      }
    }
    await sleep(250)
  }
  throw new Error(`Timed out waiting for ${APP_JSON_DIST} pages to contain route: ${route}`)
}

async function waitForAppJsonWindowTitle(title: string, timeoutMs = 90_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(APP_JSON_DIST)) {
      const appJson = await fs.readJson(APP_JSON_DIST)
      if (appJson?.window?.navigationBarTitleText === title) {
        return appJson
      }
    }
    await sleep(250)
  }
  throw new Error(`Timed out waiting for ${APP_JSON_DIST} window.navigationBarTitleText to become: ${title}`)
}

async function retryWithSourceTouch<T>(
  task: () => Promise<T>,
  touchFilePath: string,
  touchContent: string,
) {
  try {
    return await task()
  }
  catch {
    await replaceFileByRename(touchFilePath, touchContent)
    return await task()
  }
}

beforeEach(async () => {
  await cleanupResidualDevProcesses()
  await restoreAutoRoutesSources()
  await fs.remove(DIST_ROOT)
  await fs.remove(TYPED_ROUTER_PATH)
  await fs.remove(ADDED_ROUTE_VUE_PATH)
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
  await restoreAutoRoutesSources()
  await fs.remove(ADDED_ROUTE_VUE_PATH)
})

describe.sequential('auto-routes HMR (dev watch)', () => {
  it('keeps typed-router in sync when route file is added, deleted, recreated and modified', async () => {
    const addMarker = createHmrMarker('AUTO-ROUTES-ADD', 'weapp')
    const modifyMarker = createHmrMarker('AUTO-ROUTES-MODIFY', 'weapp')
    const recreateMarker = createHmrMarker('AUTO-ROUTES-RECREATE', 'weapp')
    const originalLogsSource = await fs.readFile(LOGS_VUE_PATH, 'utf8')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      cwd: APP_ROOT,
      env: {
        ...createDevProcessEnv(),
        DEBUG: 'weapp-vite:load-entry',
      },
      all: true,
    })

    try {
      await dev.waitFor(waitForFile(TYPED_ROUTER_PATH), 'initial typed-router generated')
      await dev.waitFor(waitForFileContains(TYPED_ROUTER_PATH, `"${LOGS_ROUTE}"`), 'initial logs route in typed-router')
      await dev.waitFor(
        retryWithSourceTouch(
          () => waitForFileContains(LOGS_WXML_DIST, 'logs'),
          LOGS_VUE_PATH,
          originalLogsSource,
        ),
        'initial logs page generated',
      )

      // modify existing route file
      const modifiedLogsSource = originalLogsSource.replace('logs', modifyMarker)
      await fs.writeFile(LOGS_VUE_PATH, modifiedLogsSource, 'utf8')
      await dev.waitFor(waitForFileContains(LOGS_WXML_DIST, modifyMarker), 'dist template updated after modify')
      const modifyOutput = await dev.waitForOutput(
        /hmr emit dirty=1 resolved=\d+ emitAll=false pending=1/,
        'auto-routes existing route incremental hmr log',
      )
      expect(modifyOutput).toMatch(/emitAll=false pending=1/)

      // add route — small delay lets the watcher settle after the previous modify event
      await sleep(1_000)
      await fs.writeFile(ADDED_ROUTE_VUE_PATH, `<template><view>${addMarker}</view></template>\n`, 'utf8')
      await dev.waitFor(waitForFileContains(TYPED_ROUTER_PATH, `"${ADDED_ROUTE}"`), 'typed-router includes added route')

      // delete route
      await sleep(1_000)
      await fs.remove(ADDED_ROUTE_VUE_PATH)
      await dev.waitFor(waitForFileNotContains(TYPED_ROUTER_PATH, `"${ADDED_ROUTE}"`), 'typed-router removes added route')

      // recreate route
      await sleep(1_000)
      await fs.writeFile(ADDED_ROUTE_VUE_PATH, `<template><view>${recreateMarker}</view></template>\n`, 'utf8')
      await dev.waitFor(waitForFileContains(TYPED_ROUTER_PATH, `"${ADDED_ROUTE}"`), 'typed-router restores recreated route')
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(LOGS_VUE_PATH, originalLogsSource, 'utf8')
      await fs.remove(ADDED_ROUTE_VUE_PATH)
      await fs.remove(TYPED_ROUTER_PATH)
    }
  })

  it('keeps app.json/app.js/globalData and typed-router in sync for route add/delete and app macro updates', async () => {
    const addMarker = createHmrMarker('AUTO-ROUTES-APP-ADD', 'weapp')
    const appTitleAddMarker = createHmrMarker('AUTO-ROUTES-APP-TITLE-ADD', 'weapp')
    const originalAppSource = await fs.readFile(APP_VUE_PATH, 'utf8')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      cwd: APP_ROOT,
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(TYPED_ROUTER_PATH), 'initial typed-router generated')
      await dev.waitFor(waitForFileContains(TYPED_ROUTER_PATH, `"${LOGS_ROUTE}"`), 'initial logs route in typed-router')
      await dev.waitFor(waitForFileContains(TYPED_ROUTER_PATH, `"${MARKETING_CAMPAIGN_ROUTE}"`), 'initial subpackage route in typed-router')
      await dev.waitFor(
        retryWithSourceTouch(
          () => waitForAppJsonPagesToContain(LOGS_ROUTE),
          APP_VUE_PATH,
          originalAppSource,
        ),
        'initial logs route in app.json pages',
      )
      await dev.waitFor(waitForFileContains(APP_JSON_DIST, '"subpackages/marketing"'), 'initial subPackages emitted in app.json')
      await dev.waitFor(waitForFileContains(APP_JS_DIST, '__autoRoutesPages'), 'initial globalData marker in app.js')
      await dev.waitFor(waitForFileContains(APP_JS_DIST, LOGS_ROUTE), 'initial logs route in app.js globalData')
      await dev.waitFor(waitForFileContains(APP_JS_DIST, MARKETING_CAMPAIGN_ROUTE), 'initial subpackage route in app.js globalData')

      // small delay lets the watcher settle after initial build
      await sleep(1_000)
      await fs.writeFile(ADDED_ROUTE_VUE_PATH, `<template><view>${addMarker}</view></template>\n`, 'utf8')
      await dev.waitFor(waitForFileContains(TYPED_ROUTER_PATH, `"${ADDED_ROUTE}"`), 'typed-router includes added route')

      const appAfterAddSource = originalAppSource.replace('auto-routes-define-app-json', appTitleAddMarker)
      await fs.writeFile(APP_VUE_PATH, appAfterAddSource, 'utf8')
      await dev.waitFor(waitForAppJsonWindowTitle(appTitleAddMarker), 'app.json title updates after app macro change (add stage)')
      await dev.waitFor(waitForAppJsonPagesToContain(ADDED_ROUTE), 'app.json includes added route after app macro change')
      await dev.waitFor(waitForFileContains(APP_JS_DIST, ADDED_ROUTE), 'app.js globalData includes added route after app macro change')
      await dev.waitFor(waitForFileContains(ADDED_ROUTE_WXML_DIST, addMarker), 'added route page generated after app macro change')

      await sleep(1_000)
      await fs.remove(ADDED_ROUTE_VUE_PATH)
      await dev.waitFor(waitForFileNotContains(TYPED_ROUTER_PATH, `"${ADDED_ROUTE}"`), 'typed-router removes added route')
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(APP_VUE_PATH, originalAppSource, 'utf8')
      await fs.remove(ADDED_ROUTE_VUE_PATH)
      await fs.remove(TYPED_ROUTER_PATH)
    }
  })
})
