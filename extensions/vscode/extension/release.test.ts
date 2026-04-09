import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import {
  bumpVersion,
  createReleasePlan,
  detectReleaseType,
  isReleaseWorthyFile,
  parseCommitLog,
  readUnreleasedNotes,
  renderChangelog,
} from '../scripts/prepare-release.ts'

describe('vscode release planning', () => {
  it('detects semantic version bump level from commits', () => {
    assert.equal(detectReleaseType([
      {
        subject: 'fix(vscode): adjust publish workflow',
        body: '',
      },
    ]), 'patch')

    assert.equal(detectReleaseType([
      {
        subject: 'feat(vscode): add release automation',
        body: '',
      },
    ]), 'minor')

    assert.equal(detectReleaseType([
      {
        subject: 'feat(vscode)!: replace activation flow',
        body: '',
      },
    ]), 'major')
  })

  it('filters non-runtime file changes out of release-worthy detection', () => {
    assert.equal(isReleaseWorthyFile('extensions/vscode/README.md'), false)
    assert.equal(isReleaseWorthyFile('extensions/vscode/extension/index.ts'), true)
    assert.equal(isReleaseWorthyFile('extensions/vscode/syntaxes/weapp-vite-custom-blocks.tmLanguage.json'), true)
  })

  it('releases unreleased changelog entries before falling back to commit subjects', () => {
    const changelog = [
      '# Changelog',
      '',
      '## Unreleased',
      '',
      '- Add release automation.',
      '- Publish from GitHub Actions.',
      '',
      '## 0.0.1',
      '',
      '- Initial release.',
      '',
    ].join('\n')

    const plan = createReleasePlan(
      changelog,
      [
        {
          subject: 'feat(vscode): automate release',
          body: '',
        },
      ],
      ['extensions/vscode/extension/index.ts'],
      '0.0.2',
      'HEAD',
      null,
    )

    assert.equal(plan.shouldRelease, true)
    assert.equal(plan.releaseType, 'minor')
    assert.equal(plan.nextVersion, '0.1.0')
    assert.deepEqual(plan.notes, [
      '- Add release automation.',
      '- Publish from GitHub Actions.',
    ])
  })

  it('renders a released changelog entry and resets unreleased placeholder', () => {
    const next = renderChangelog([
      '# Changelog',
      '',
      '## Unreleased',
      '',
      '- Add release automation.',
      '',
      '## 0.0.1',
      '',
      '- Initial release.',
      '',
    ].join('\n'), '0.0.3', ['- Add release automation.'], '2026-04-09')

    assert.match(next, /## Unreleased\n\n- Nothing yet\./)
    assert.match(next, /## 0\.0\.3 - 2026-04-09\n\n- Add release automation\./)
  })

  it('parses git log blocks and bumps versions predictably', () => {
    const commits = parseCommitLog('feat(vscode): automate release\n\nline 1\u001Efix(vscode): adjust docs\n\u001E')

    assert.deepEqual(commits, [
      {
        subject: 'feat(vscode): automate release',
        body: 'line 1',
      },
      {
        subject: 'fix(vscode): adjust docs',
        body: '',
      },
    ])

    assert.equal(bumpVersion('1.2.3', 'patch'), '1.2.4')
    assert.equal(bumpVersion('1.2.3', 'minor'), '1.3.0')
    assert.equal(bumpVersion('1.2.3', 'major'), '2.0.0')
    assert.deepEqual(readUnreleasedNotes('## Unreleased\n\n- One\n- Nothing yet.\n'), ['- One'])
  })
})
