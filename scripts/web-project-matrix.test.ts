import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { discoverWebProjects, webProjectExpectationOverrides } from './web-project-matrix'

interface PackageManifest {
  scripts?: Record<string, string>
}

const ROOT = path.resolve(import.meta.dirname, '..')

describe('Web project matrix', () => {
  it('covers every e2e app and template with standard Web commands and entry', async () => {
    const projects = await discoverWebProjects(ROOT)
    expect(projects).toHaveLength(46)
    expect(projects.find(project => project.relativeRoot === 'e2e-apps/uview-plus-compat'))
      .toMatchObject({
        kind: 'e2e-app',
        expectation: 'runtime',
      })
    expect(projects.find(project => project.relativeRoot === 'e2e-apps/wot-ui-compat'))
      .toMatchObject({
        kind: 'e2e-app',
        expectation: 'runtime',
      })

    for (const project of projects) {
      const manifest = JSON.parse(
        await readFile(path.join(project.root, 'package.json'), 'utf8'),
      ) as PackageManifest
      expect.soft(manifest.scripts?.['dev:web'], project.relativeRoot)
        .toBe('wv dev -p web --host')
      expect.soft(manifest.scripts?.['build:web'], project.relativeRoot)
        .toBe('wv build -p web')
      await expect.soft(access(path.join(project.root, 'index.html')), project.relativeRoot)
        .resolves
        .toBeUndefined()
    }
  })

  it('keeps special expectations scoped to discovered projects', async () => {
    const projects = await discoverWebProjects(ROOT)
    const relativeRoots = new Set(projects.map(project => project.relativeRoot))

    for (const relativeRoot of Object.keys(webProjectExpectationOverrides)) {
      expect(relativeRoots.has(relativeRoot), relativeRoot).toBe(true)
    }
    expect(projects.filter(project => project.expectation === 'shell').map(project => project.relativeRoot))
      .toEqual(['e2e-apps/lib-mode'])
    expect(projects.filter(project => project.expectation === 'startup-error').map(project => project.relativeRoot))
      .toEqual(['e2e-apps/script-setup-macros-js-with-defaults-invalid'])
  })
})
