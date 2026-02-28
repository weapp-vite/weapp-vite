import { setTimeout as sleep } from 'node:timers/promises'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, waitForFileContains } from '../utils/hmr-helpers'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/auto-routes-define-app-json')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const DIST_APP_JSON_PATH = path.join(DIST_ROOT, 'app.json')
const TYPED_ROUTER_PATH = path.join(APP_ROOT, 'typed-router.d.ts')
const APP_JSON_PATH = path.join(APP_ROOT, 'src/app.json')

const LOGS_VUE_PATH = path.join(APP_ROOT, 'src/pages/logs/index.vue')
const ADDED_ROUTE_VUE_PATH = path.join(APP_ROOT, 'src/pages/logs/hmr-added.vue')
const LOGS_ROUTE = 'pages/logs/index'
const ADDED_ROUTE = 'pages/logs/hmr-added'
const LOGS_WXML_DIST = path.join(DIST_ROOT, `${LOGS_ROUTE}.wxml`)
const ADDED_WXML_DIST = path.join(DIST_ROOT, `${ADDED_ROUTE}.wxml`)

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

async function updateAppJsonPages(updater: (pages: string[]) => string[]) {
  const appJson = await fs.readJson(APP_JSON_PATH)
  const pages = Array.isArray(appJson.pages) ? appJson.pages : []
  appJson.pages = updater([...pages])
  await fs.writeJson(APP_JSON_PATH, appJson, { spaces: 2 })
}

beforeEach(async () => {
  await cleanupResidualDevProcesses()
  await fs.remove(DIST_ROOT)
  await fs.remove(TYPED_ROUTER_PATH)
  await fs.remove(ADDED_ROUTE_VUE_PATH)
  await updateAppJsonPages((pages) => {
    return pages.filter(page => page !== ADDED_ROUTE)
  })
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
  await fs.remove(ADDED_ROUTE_VUE_PATH)
})

describe.sequential('auto-routes HMR (dev watch)', () => {
  it('keeps typed-router and dist route output in sync when route file is deleted, recreated and modified', async () => {
    const addMarker = createHmrMarker('AUTO-ROUTES-ADD', 'weapp')
    const modifyMarker = createHmrMarker('AUTO-ROUTES-MODIFY', 'weapp')
    const recreateMarker = createHmrMarker('AUTO-ROUTES-RECREATE', 'weapp')
    const originalLogsSource = await fs.readFile(LOGS_VUE_PATH, 'utf8')
    const originalAppJson = await fs.readFile(APP_JSON_PATH, 'utf8')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      cwd: APP_ROOT,
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(TYPED_ROUTER_PATH), 'initial typed-router generated')
      await dev.waitFor(waitForFileContains(TYPED_ROUTER_PATH, `"${LOGS_ROUTE}"`), 'initial logs route in typed-router')
      await dev.waitFor(waitForFileContains(LOGS_WXML_DIST, 'logs'), 'initial logs page generated')

      // modify existing route file
      const modifiedLogsSource = originalLogsSource.replace('logs', modifyMarker)
      await fs.writeFile(LOGS_VUE_PATH, modifiedLogsSource, 'utf8')
      await dev.waitFor(waitForFileContains(LOGS_WXML_DIST, modifyMarker), 'dist template updated after modify')

      // add route
      await fs.writeFile(ADDED_ROUTE_VUE_PATH, `<template><view>${addMarker}</view></template>\n`, 'utf8')
      await updateAppJsonPages((pages) => {
        if (!pages.includes(ADDED_ROUTE)) {
          pages.push(ADDED_ROUTE)
        }
        return pages
      })
      await dev.waitFor(waitForFileContains(DIST_APP_JSON_PATH, ADDED_ROUTE), 'dist app.json includes added route')
      await dev.waitFor(waitForFileContains(TYPED_ROUTER_PATH, `"${ADDED_ROUTE}"`), 'typed-router includes added route')
      await dev.waitFor(waitForFileContains(ADDED_WXML_DIST, addMarker), 'dist template generated for added route')

      // delete route
      await updateAppJsonPages(pages => pages.filter(page => page !== ADDED_ROUTE))
      await dev.waitFor(waitForFileNotContains(DIST_APP_JSON_PATH, ADDED_ROUTE), 'dist app.json removes added route')
      await fs.remove(ADDED_ROUTE_VUE_PATH)
      await dev.waitFor(waitForFileNotContains(TYPED_ROUTER_PATH, `"${ADDED_ROUTE}"`), 'typed-router removes added route')

      // recreate route
      await fs.writeFile(ADDED_ROUTE_VUE_PATH, `<template><view>${recreateMarker}</view></template>\n`, 'utf8')
      await updateAppJsonPages((pages) => {
        if (!pages.includes(ADDED_ROUTE)) {
          pages.push(ADDED_ROUTE)
        }
        return pages
      })
      await dev.waitFor(waitForFileContains(DIST_APP_JSON_PATH, ADDED_ROUTE), 'dist app.json restores recreated route')
      await dev.waitFor(waitForFileContains(TYPED_ROUTER_PATH, `"${ADDED_ROUTE}"`), 'typed-router restores recreated route')
      await dev.waitFor(waitForFileContains(ADDED_WXML_DIST, recreateMarker), 'dist template updated after recreate')
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(LOGS_VUE_PATH, originalLogsSource, 'utf8')
      await fs.writeFile(APP_JSON_PATH, originalAppJson, 'utf8')
      await fs.remove(ADDED_ROUTE_VUE_PATH)
      await fs.remove(TYPED_ROUTER_PATH)
    }
  })
})
