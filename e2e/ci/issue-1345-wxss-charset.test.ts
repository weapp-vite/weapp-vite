import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertAuthorIssueOutputs, buildAuthorIssueFixture, prepareAuthorIssueFixture } from '../utils/authorIssueFixture'

const FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1345-wxss-charset'

describe('issue #1345 WXSS charset output', { concurrent: false }, () => {
  it('removes Sass charset declarations while preserving scoped styles', async () => {
    const project = await prepareAuthorIssueFixture(FIXTURE)
    try {
      const output = await buildAuthorIssueFixture(project, 'default')
      await assertAuthorIssueOutputs(output, ['pages/index/index'])
      const wxss = await readFile(path.join(output, 'pages/index/index.wxss'), 'utf8')

      expect(wxss).not.toMatch(/^\uFEFF?@charset\b/im)
      expect(wxss).toMatch(/\.a\.data-v-[\w-]+\s*\{/)
      expect(wxss).toContain('color: red')
    }
    finally {
      await rm(project, { recursive: true, force: true })
    }
  }, 180_000)
})
