import { expect, it } from 'vitest'
import { isolateCaptureTestEnvironment } from './captureTestFixture.ts'

it('isolates inherited capture controls and restores the caller scope after mock cleanup', () => {
  const env = {
    WEAPP_VITE_E2E_EXCLUDE_PROJECTS: 'excluded-fixture',
    WEAPP_VITE_E2E_RUNTIME_PROVIDER: 'headless',
    WEAPP_VITE_E2E_DOM_ACCEPTANCE: '1',
    WEAPP_VITE_VERIFICATION_LOCAL_DIR: 'caller-capture',
    UNRELATED: 'preserved',
  }
  const original = { ...env }
  const restore = isolateCaptureTestEnvironment(env)
  expect(env).toEqual({ UNRELATED: 'preserved' })
  env.WEAPP_VITE_E2E_TASK_FILTER = 'test-only-filter'
  restore()
  expect(env).toEqual(original)
})
