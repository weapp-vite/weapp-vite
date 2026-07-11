import { afterAll, describe, expect, it } from 'vitest'
import { COMPOSITION_API_E2E_NAMES } from '../../e2e-apps/wevu-runtime-e2e/src/shared/compositionApiCoverage'
import { launchAutomator } from '../utils/automator'
import { APP_ROOT, runBuild } from '../wevu-runtime.utils'

const EXPECTED_APIS = COMPOSITION_API_E2E_NAMES

let sharedMiniProgram: any = null
let sharedBuildPrepared = false

async function getSharedMiniProgram() {
  if (!sharedBuildPrepared) {
    await runBuild('weapp')
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchAutomator({
      projectPath: APP_ROOT,
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

async function assertCoverageForRoute(miniProgram: any, route: string) {
  const page = await miniProgram.reLaunch(route)
  if (!page) {
    throw new Error(`Failed to launch ${route}`)
  }
  await page.waitFor(160)

  const result = await page.callMethod('runE2E')
  if (!result?.ok) {
    throw new Error(`Coverage failed for ${route}: ${JSON.stringify(result?.details ?? {}, null, 2)}`)
  }
  expect(result?.ok).toBe(true)

  const checks = result?.checks ?? {}
  const details = result?.details ?? {}
  const expectedApis = Array.isArray(details.expectedApis) ? details.expectedApis : []
  expect([...expectedApis].sort()).toEqual([...EXPECTED_APIS].sort())

  for (const api of EXPECTED_APIS) {
    expect(checks[api], `route ${route} api ${api} should be covered`).toBe(true)
  }

  expect(Array.isArray(details.failedApis)).toBe(true)
  expect(details.failedApis).toEqual([])
}

describe.sequential('wevu composition api (weapp e2e)', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('covers all public composition APIs on the TS page', async () => {
    const miniProgram = await getSharedMiniProgram()

    try {
      await assertCoverageForRoute(miniProgram, '/pages/composition-api/index')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('covers all public composition APIs on the Vue SFC page', async () => {
    const miniProgram = await getSharedMiniProgram()

    try {
      await assertCoverageForRoute(miniProgram, '/pages/composition-api-vue/index')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
