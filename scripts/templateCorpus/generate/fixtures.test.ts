import type { CorpusDocument } from '../types'
import type { GenerationResult } from './run'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { readFrameworkCatalog } from './catalog'
import { prepareMatrixFixture } from './fixtures'
import { mpxFixtureFiles } from './fixtures/mpx'
import { retainGeneratedTemplates } from './run'

describe('authored framework matrix fixtures', () => {
  it('respects the JD compiler restriction without deleting its second page', () => {
    expect(mpxFixtureFiles('wx')['app.mpx']).toContain('subPackages')
    expect(mpxFixtureFiles('jd')['app.mpx']).not.toContain('subPackages')
    expect(mpxFixtureFiles('jd')['app.mpx']).toContain('./subpackage/detail/index')
    expect(mpxFixtureFiles('jd')['subpackage/detail/index.mpx']).toContain('subpackage')
  })

  it('prepares every selected release with explicit quota exclusion and full source identities', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'matrix-fixtures-'))
    try {
      for (const release of await readFrameworkCatalog()) {
        const result = await prepareMatrixFixture(release.framework, release.version, directory)
        expect(result.provenance).toMatchObject({ kind: 'controlled-fixture', quotaEligible: false, framework: release.framework, version: release.version })
        expect(result.provenance.files.length).toBeGreaterThanOrEqual(4)
        if (release.framework === 'ant-design-mini') {
          expect(result.provenance.features).toContain('upstream-preprocessor')
          expect(result.provenance.features).not.toContain('subpackage')
        }
        else {
          expect(result.provenance.features).toContain('subpackage')
        }
        expect(await readFile(path.join(result.directory, 'fixture.json'), 'utf8')).toContain('"quotaEligible":false')
        if (release.framework === 'taro') {
          expect(result.provenance.features).toContain('component-children')
          expect(result.provenance.features).not.toContain('named-slot')
        }
        else {
          expect(result.provenance.features).toContain('named-slot')
        }
      }
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('keeps authored compiler outputs out of corpus documents and removes the origin shape', () => {
    const result: GenerationResult = { directory: 'owned-generation', documents: [], generations: [], matrixTemplates: [] }
    const documents: CorpusDocument[] = [{ source: '<view/>', sha256: 'input-hash', origins: [{
      repository: 'owner/project',
      commit: 'a'.repeat(40),
      path: 'out/development/page.xhsml',
      platform: 'xhs',
      profileId: 'xhs-xml',
      category: 'generated',
      generationId: 'controlled-build',
      licenseId: 'confirmed',
      expectation: 'valid',
    }] }]
    retainGeneratedTemplates(result, documents, 'authored-fixture')
    expect(result.documents).toEqual([])
    expect(result.matrixTemplates).toEqual([{
      source: '<view/>',
      sha256: 'input-hash',
      path: 'out/development/page.xhsml',
      platform: 'xhs',
      profileId: 'xhs-xml',
      generationId: 'controlled-build',
      fixtureId: 'authored-fixture',
      quotaEligible: false,
    }])
    retainGeneratedTemplates(result, documents)
    expect(result.documents).toEqual(documents)
  })
})
