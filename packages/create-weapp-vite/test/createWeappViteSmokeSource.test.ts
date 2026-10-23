import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createScenario } from '../../../scripts/createWeappViteSmoke/commands.mjs'
import { validateDependencyTarballScenarios } from '../../../scripts/createWeappViteSmoke/dependencyTarballs.mjs'
import { resolveSmokeSource } from '../../../scripts/createWeappViteSmoke/source.mjs'
import { mergeSmokeReports, renderSmokeReport } from '../../../scripts/merge-create-weapp-vite-smoke-reports.mjs'

const roots: string[] = []
const commit = 'a'.repeat(40)

async function createTarball() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scaffold-source-'))
  roots.push(root)
  const tarball = path.join(root, 'candidate.tgz')
  await fs.writeFile(tarball, 'candidate scaffold bytes')
  return { root, tarball }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

describe('scaffold smoke source evidence', () => {
  it('keeps published registry smoke as the default', async () => {
    expect(await resolveSmokeSource()).toEqual({ source: 'published', sourceCommit: null, tarballSha256: null })
    expect(await resolveSmokeSource({ sourceCommit: commit })).toEqual({ source: 'published', sourceCommit: commit, tarballSha256: null })
  })

  it('binds workspace evidence to the actual tarball bytes without exposing its path', async () => {
    const { root, tarball } = await createTarball()
    const expected = createHash('sha256').update('candidate scaffold bytes').digest('hex')
    const identity = await resolveSmokeSource({ source: 'workspace', sourceCommit: commit, tarball, expectedTarballSha256: expected })
    expect(identity).toEqual({ source: 'workspace', sourceCommit: commit, tarballSha256: expected })
    expect(JSON.stringify(identity)).not.toContain(root)
    await fs.writeFile(tarball, 'replaced candidate')
    await expect(resolveSmokeSource({ source: 'workspace', sourceCommit: commit, tarball, expectedTarballSha256: expected })).rejects.toThrow('does not match')
  })

  it('retains local tarball compatibility while leaving an unspecified commit unknown', async () => {
    const { tarball } = await createTarball()
    expect(await resolveSmokeSource({ tarball })).toMatchObject({ source: 'workspace', sourceCommit: null })
  })

  it('rejects source confusion, malformed commits and invalid expected hashes', async () => {
    const { tarball } = await createTarball()
    await expect(resolveSmokeSource({ source: 'other' })).rejects.toThrow('published or workspace')
    await expect(resolveSmokeSource({ source: 'workspace' })).rejects.toThrow('requires a scaffold tarball')
    await expect(resolveSmokeSource({ source: 'published', tarball })).rejects.toThrow('must use the registry')
    await expect(resolveSmokeSource({ sourceCommit: 'main' })).rejects.toThrow('complete Git commit')
    await expect(resolveSmokeSource({ tarball, expectedTarballSha256: 'invalid' })).rejects.toThrow('does not match')
    await expect(resolveSmokeSource({ expectedTarballSha256: '0'.repeat(64) })).rejects.toThrow('does not match')
  })

  it('keeps ordinary Yarn installation and the pnpm-only runtime override boundary', () => {
    const yarn = createScenario('yarn')
    expect(yarn.installCommand()).toEqual({ command: 'yarn', args: ['install'] })
    expect(yarn.buildCommand()).toEqual({ command: 'yarn', args: ['run', 'build'] })
    expect(yarn.devCommand()).toEqual({ command: 'yarn', args: ['run', 'dev'] })
    expect(() => validateDependencyTarballScenarios([], [yarn])).not.toThrow()
    expect(() => validateDependencyTarballScenarios([{ name: 'weapp-vite' }], [yarn])).toThrow('CREATE_WEAPP_VITE_SCENARIOS=pnpm')
  })

  it('keeps source, checkout and artifact identity across successful and failed report rows', async () => {
    const { tarball } = await createTarball()
    const workspace = await resolveSmokeSource({ source: 'workspace', sourceCommit: commit, tarball })
    const published = await resolveSmokeSource({ source: 'published', sourceCommit: 'b'.repeat(40) })
    const scenario = { registryProfile: 'npmjs', scenario: 'yarn', template: 'default', actualCreateVersion: '1.0.0' }
    const reports = [published, workspace].map(identity => ({
      ...identity,
      os: 'windows',
      nodeVersion: '24',
      artifact: identity.source === 'workspace' ? 'candidate.tgz' : 'registry',
      results: [scenario],
      failures: [{ ...scenario, stage: 'install', kind: 'product', error: 'engine mismatch' }],
      registries: [{ name: 'npmjs' }],
      summary: { status: 'product-failure' },
    }))
    const merged = mergeSmokeReports(reports)
    for (const collection of [merged.rows, merged.failures, merged.registries, merged.summaries]) {
      expect(collection).toHaveLength(2)
      expect(collection).toEqual(expect.arrayContaining([
        expect.objectContaining(published),
        expect.objectContaining(workspace),
      ]))
    }
    const markdown = renderSmokeReport(merged)
    expect(markdown).toContain('Scaffold source | Checkout commit | Scaffold tarball SHA256')
    expect(markdown).toContain(`| workspace | ${commit} | ${workspace.tarballSha256} |`)
    expect(markdown).toContain(`| published | ${published.sourceCommit} | - |`)
    expect(markdown).toContain('Product failures: 2')
  })
})
