import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import {
  compareSemverVersions,
  createMarketplaceReleasePlan,
  isMainReleaseRef,
  readMarketplaceLatestVersion,
  readVersionFromPackageJson,
} from '../scripts/plan-marketplace-release.ts'

describe('vscode marketplace release planning', () => {
  it('reads version from package.json content', () => {
    assert.equal(readVersionFromPackageJson(JSON.stringify({ version: '1.2.3' })), '1.2.3')
  })

  it('compares semver versions with prerelease support', () => {
    assert.equal(compareSemverVersions('0.1.0', '0.0.5'), 1)
    assert.equal(compareSemverVersions('0.1.0-alpha.1', '0.1.0-alpha.2'), -1)
    assert.equal(compareSemverVersions('0.1.0', '0.1.0-beta.1'), 1)
    assert.equal(compareSemverVersions('0.1.0', '0.1.0'), 0)
  })

  it('only treats refs/heads/main as releasable release ref', () => {
    assert.equal(isMainReleaseRef('refs/heads/main'), true)
    assert.equal(isMainReleaseRef('refs/heads/release/pnpm-version'), false)
    assert.equal(isMainReleaseRef('refs/tags/v1.0.0'), false)
    assert.equal(isMainReleaseRef(null), false)
  })

  it('reads the latest marketplace version from extension query results', () => {
    assert.equal(readMarketplaceLatestVersion({
      results: [
        {
          extensions: [
            {
              versions: [
                { version: '0.0.5' },
                { version: '0.0.4' },
                { version: '0.1.0-beta.1' },
              ],
            },
          ],
        },
      ],
    }), '0.1.0-beta.1')

    assert.equal(readMarketplaceLatestVersion({ results: [{ extensions: [] }] }), null)
  })

  it('publishes when Marketplace is behind even if the tag already exists', () => {
    assert.deepEqual(createMarketplaceReleasePlan('0.1.0', '0.0.5', true, 'refs/heads/main'), {
      currentVersion: '0.1.0',
      currentRef: 'refs/heads/main',
      isMainRef: true,
      marketplaceVersion: '0.0.5',
      releaseTag: 'vscode-extension-v0.1.0',
      shouldPublish: true,
      shouldTag: false,
      tagExists: true,
    })
  })

  it('repairs a missing remote tag when Marketplace is already current', () => {
    assert.deepEqual(createMarketplaceReleasePlan('0.1.0', '0.1.0', false, 'refs/heads/main'), {
      currentVersion: '0.1.0',
      currentRef: 'refs/heads/main',
      isMainRef: true,
      marketplaceVersion: '0.1.0',
      releaseTag: 'vscode-extension-v0.1.0',
      shouldPublish: false,
      shouldTag: true,
      tagExists: false,
    })
  })

  it('publishes and tags when both Marketplace and the remote tag are behind', () => {
    const plan = createMarketplaceReleasePlan('0.1.0', '0.0.5', false, 'refs/heads/main')

    assert.equal(plan.shouldPublish, true)
    assert.equal(plan.shouldTag, true)
  })

  it('publishes an initial Marketplace version regardless of an existing tag', () => {
    const plan = createMarketplaceReleasePlan('0.1.0', null, true, 'refs/heads/main')

    assert.equal(plan.shouldPublish, true)
    assert.equal(plan.shouldTag, false)
  })

  it('skips Marketplace and tag mutations outside main', () => {
    const plan = createMarketplaceReleasePlan('0.1.0', '0.0.5', false, 'refs/heads/release/pnpm-version')

    assert.equal(plan.shouldPublish, false)
    assert.equal(plan.shouldTag, false)
  })

  it('fails when Marketplace is ahead of the repository', () => {
    assert.throws(
      () => createMarketplaceReleasePlan('0.1.0', '0.1.1', false, 'refs/heads/main'),
      /Marketplace version 0\.1\.1 is ahead of repository version 0\.1\.0/,
    )
  })
})
