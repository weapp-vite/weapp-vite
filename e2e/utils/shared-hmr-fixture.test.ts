import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import {
  buildOriginalHmrPageWxml,
  buildOriginalHmrVueSource,
  resolveSharedHmrPaths,
} from './shared-hmr-fixture'

const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/wevu-runtime-e2e')
const SHARED_HMR_PATHS = resolveSharedHmrPaths(APP_ROOT)

describe('shared HMR fixture baselines', () => {
  it('matches the tracked page and Vue sources', async () => {
    const [pageWxml, vueSource] = await Promise.all([
      fs.readFile(SHARED_HMR_PATHS.hmrPageWxml, 'utf8'),
      fs.readFile(SHARED_HMR_PATHS.hmrSfcVue, 'utf8'),
    ])

    expect(buildOriginalHmrPageWxml()).toBe(pageWxml)
    expect(buildOriginalHmrVueSource()).toBe(vueSource)
  })
})
