import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createHeadlessSession } from '../src/runtime'
import { initialConditionalBranchEvents, initialConditionalBranchFiles } from './helpers/initialConditionalBranch'

it('preserves native ready for the initial branch replaced before attachment', () => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-initial-branch-'))
  for (const [file, source] of initialConditionalBranchFiles) {
    const target = path.join(projectPath, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, source)
  }
  const session = createHeadlessSession({ projectPath })
  try {
    const page = session.reLaunch('/pages/index/index')
    expect(page.inspect()).toEqual(initialConditionalBranchEvents)
    expect(session.renderCurrentPage().wxml).toContain('id="column"')
    expect(session.renderCurrentPage().wxml).not.toContain('id="row"')
    expect(page.inspect()).toEqual(initialConditionalBranchEvents)
  }
  finally {
    session.close()
    fs.rmSync(projectPath, { recursive: true, force: true })
  }
})
