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
    assert.equal(isMainReleaseRef('refs/heads/changeset-release/main'), false)
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

  it('publishes when current version is higher than marketplace version and tag does not already exist', () => {
    assert.deepEqual(createMarketplaceReleasePlan('0.1.0', '0.1.0', '0.0.5', false, 'refs/heads/main'), {
      currentVersion: '0.1.0',
      currentRef: 'refs/heads/main',
      isMainRef: true,
      marketplaceVersion: '0.0.5',
      previousVersion: '0.1.0',
      releaseTag: 'vscode-extension-v0.1.0',
      shouldPublish: true,
      tagExists: false,
    })

    assert.deepEqual(createMarketplaceReleasePlan('0.0.3', '0.0.2', '0.0.2', false, 'refs/heads/main'), {
      currentVersion: '0.0.3',
      currentRef: 'refs/heads/main',
      isMainRef: true,
      marketplaceVersion: '0.0.2',
      previousVersion: '0.0.2',
      releaseTag: 'vscode-extension-v0.0.3',
      shouldPublish: true,
      tagExists: false,
    })
  })

  it('does not publish when marketplace is already current or newer, or when tag already exists', () => {
    assert.equal(createMarketplaceReleasePlan('0.0.3', '0.0.3', '0.0.3', false, 'refs/heads/main').shouldPublish, false)
    assert.equal(createMarketplaceReleasePlan('0.0.3', '0.0.2', '0.0.4', false, 'refs/heads/main').shouldPublish, false)
    assert.equal(createMarketplaceReleasePlan('0.0.3', '0.0.2', '0.0.2', true, 'refs/heads/main').shouldPublish, false)
    assert.equal(createMarketplaceReleasePlan('0.0.4', '0.0.3', '0.0.3', false, 'refs/heads/changeset-release/main').shouldPublish, false)
  })

  it('publishes initial marketplace release when no remote version exists and tag is absent', () => {
    assert.equal(createMarketplaceReleasePlan('0.0.1', null, null, false, 'refs/heads/main').shouldPublish, true)
    assert.equal(createMarketplaceReleasePlan('0.0.1', null, null, true, 'refs/heads/main').shouldPublish, false)
    assert.equal(createMarketplaceReleasePlan('0.0.1', null, null, false, 'refs/heads/changeset-release/main').shouldPublish, false)
  })
})
