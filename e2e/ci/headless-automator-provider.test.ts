import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { E2E_RUNTIME_PROVIDER_ENV } from '../utils/runtimeProvider'

describe('headless automator provider', () => {
  afterEach(() => {
    delete process.env[E2E_RUNTIME_PROVIDER_ENV]
  })

  it('launches the base app through the headless provider', async () => {
    process.env[E2E_RUNTIME_PROVIDER_ENV] = 'headless'

    const miniProgram = await launchAutomator({
      projectPath: path.resolve(import.meta.dirname, '../../e2e-apps/base'),
    })

    const page = await miniProgram.reLaunch('/pages/index/index')
    expect(await page.data('__e2eResult.status')).toBe('ready')

    await page.callMethod('onTap')
    expect(await page.data('__e2eResult.status')).toBe('tapped')

    const currentPage = await miniProgram.currentPage()
    expect(await currentPage?.data('__e2eData.target')).toBe('index snapshot')
  })
})
