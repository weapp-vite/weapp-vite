import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import {
  createMarketplaceReleasePlan,
  readVersionFromPackageJson,
} from '../scripts/plan-marketplace-release.ts'

describe('vscode marketplace release planning', () => {
  it('reads version from package.json content', () => {
    assert.equal(readVersionFromPackageJson(JSON.stringify({ version: '1.2.3' })), '1.2.3')
  })

  it('publishes only when version changed and tag does not already exist', () => {
    assert.deepEqual(createMarketplaceReleasePlan('0.0.3', '0.0.2', false), {
      currentVersion: '0.0.3',
      previousVersion: '0.0.2',
      releaseTag: 'vscode-extension-v0.0.3',
      shouldPublish: true,
      tagExists: false,
    })

    assert.equal(createMarketplaceReleasePlan('0.0.3', '0.0.3', false).shouldPublish, false)
    assert.equal(createMarketplaceReleasePlan('0.0.3', '0.0.2', true).shouldPublish, false)
    assert.equal(createMarketplaceReleasePlan('0.0.3', null, false).shouldPublish, false)
  })
})
