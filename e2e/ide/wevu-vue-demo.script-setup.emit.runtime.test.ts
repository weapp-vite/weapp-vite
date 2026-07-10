import { rm } from 'node:fs/promises'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../apps/wevu-vue-demo')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const ROUTE = '/pages/vue-compat/script-setup/index'

interface EmitMatrixRecord {
  detailType?: string
  first?: string
  kind?: string
  label: string
  marker?: string
  metaSource?: string
  nativeType?: string
  payloadType: string
  second?: number
  thirdOk?: boolean
  timeStampType?: string
  title?: string
  tupleLength?: number
  value?: string
}

async function runBuild() {
  await rm(DIST_ROOT, { recursive: true, force: true })
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: 'ide:wevu-vue-demo-script-setup-emit',
  })
}

async function tapById(page: any, id: string) {
  await page.callMethodWithOptions('runEmitE2E', { routeOnly: true }, id)
  await page.waitFor(180)
}

async function reLaunchWithRetry(miniProgram: any, route: string, retries = 4) {
  let lastError: unknown

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await miniProgram.reLaunch(route)
    }
    catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      if (!message.includes('App.getCurrentPage') || attempt >= retries) {
        throw error
      }
      await new Promise(resolve => setTimeout(resolve, 400))
    }
  }

  throw lastError
}

async function readRecords(page: any) {
  const records = await page.data('emitMatrixRecords')
  expect(Array.isArray(records)).toBe(true)
  return records as EmitMatrixRecord[]
}

async function expectLatestRecord(page: any, expected: Partial<EmitMatrixRecord>) {
  const records = await readRecords(page)
  expect(records.length).toBeGreaterThan(0)
  expect(records[0]).toMatchObject(expected)
}

let sharedMiniProgram: any = null
let sharedBuildPrepared = false

async function getSharedMiniProgram() {
  if (!sharedBuildPrepared) {
    await runBuild()
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      skipWarmup: true,
    })
  }
  return sharedMiniProgram
}

async function releaseSharedMiniProgram(miniProgram: any) {
  if (!sharedMiniProgram || sharedMiniProgram === miniProgram) {
    return
  }
  await miniProgram.close()
}

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await miniProgram.close()
}

describe.sequential('wevu-vue-demo script setup emit runtime', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('unwraps emitted detail for handler / $event / inline $event.title and preserves native event payloads', async () => {
    const miniProgram = await getSharedMiniProgram()

    try {
      const page = await reLaunchWithRetry(miniProgram, ROUTE)
      if (!page) {
        throw new Error(`Failed to launch route: ${ROUTE}`)
      }

      await page.waitFor(300)
      await tapById(page, 'emit-matrix-reset')

      await tapById(page, 'emit-direct-payload')
      await expectLatestRecord(page, {
        label: 'payload-direct',
        payloadType: 'object',
        kind: 'payload',
        marker: 'payload-detail',
        metaSource: 'CompatEmitMatrix',
        title: 'matrix-payload',
      })

      await tapById(page, 'emit-explicit-payload')
      await expectLatestRecord(page, {
        label: 'payload-explicit-$event',
        payloadType: 'object',
        kind: 'payload',
        marker: 'payload-detail',
        metaSource: 'CompatEmitMatrix',
        title: 'matrix-payload',
      })

      await tapById(page, 'emit-inline-payload')
      await expectLatestRecord(page, {
        label: 'payload-inline-title',
        payloadType: 'string',
        value: 'matrix-payload',
      })

      await tapById(page, 'emit-direct-native')
      await expectLatestRecord(page, {
        label: 'native-direct',
        payloadType: 'object',
        nativeType: 'tap',
        detailType: 'object',
        timeStampType: 'number',
      })

      await tapById(page, 'emit-explicit-native')
      await expectLatestRecord(page, {
        label: 'native-explicit-$event',
        payloadType: 'object',
        nativeType: 'tap',
        detailType: 'object',
        timeStampType: 'number',
      })

      await tapById(page, 'emit-direct-tuple')
      await expectLatestRecord(page, {
        label: 'tuple-direct',
        payloadType: 'array',
        first: 'alpha',
        second: 2,
        thirdOk: true,
        tupleLength: 3,
      })

      await tapById(page, 'emit-explicit-tuple')
      await expectLatestRecord(page, {
        label: 'tuple-explicit-$event',
        payloadType: 'array',
        first: 'alpha',
        second: 2,
        thirdOk: true,
        tupleLength: 3,
      })

      await tapById(page, 'emit-direct-empty')
      await expectLatestRecord(page, {
        label: 'empty-direct',
        payloadType: 'undefined',
      })

      await tapById(page, 'emit-explicit-empty')
      await expectLatestRecord(page, {
        label: 'empty-explicit-$event',
        payloadType: 'undefined',
      })

      await tapById(page, 'emit-direct-options')
      await expectLatestRecord(page, {
        label: 'options-direct',
        payloadType: 'object',
        kind: 'options',
        marker: 'options-detail',
        metaSource: 'CompatEmitMatrix',
        title: 'matrix-options',
      })

      await tapById(page, 'emit-explicit-options')
      await expectLatestRecord(page, {
        label: 'options-explicit-$event',
        payloadType: 'object',
        kind: 'options',
        marker: 'options-detail',
        metaSource: 'CompatEmitMatrix',
        title: 'matrix-options',
      })
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
