import { existsSync } from 'node:fs'
import { rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildIssue997, createIssue997Project, ISSUE_997_OUTPUTS } from '../utils/issue997Build'

let project: string
const stale = ['dist/stale.txt', 'dist-plugin/stale.txt']

describe('issue #997: build output cleanup ownership', () => {
  beforeAll(async () => {
    project = await createIssue997Project()
  })
  beforeEach(async () => {
    await buildIssue997(project)
  })
  afterAll(async () => {
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  })

  it.each(['config', 'cli'])('preserves app and isolated plugin outputs through %s', async (source) => {
    for (const file of stale) {
      await writeFile(path.join(project, file), 'old output')
    }
    expect(await buildIssue997(project, { preserve: source === 'config', cli: source === 'cli', verify: true })).toEqual([])
    for (const file of [...ISSUE_997_OUTPUTS, ...stale]) {
      expect(existsSync(path.join(project, file)), file).toBe(true)
    }
  })

  it('keeps default cleanup for app and isolated plugin outputs', async () => {
    for (const file of stale) {
      await writeFile(path.join(project, file), 'old output')
    }
    await buildIssue997(project)
    for (const file of stale) {
      expect(existsSync(path.join(project, file)), file).toBe(false)
    }
    for (const file of ISSUE_997_OUTPUTS) {
      expect(existsSync(path.join(project, file)), file).toBe(true)
    }
  })
})
