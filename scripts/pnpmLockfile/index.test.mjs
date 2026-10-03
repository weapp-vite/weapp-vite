import { expect, it } from 'vitest'
import { parsePnpmLockfile } from './index.mjs'

const projectDocument = `lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      rolldown:
        specifier: 1.2.0
        version: 1.2.0
packages:
  rolldown@1.2.0:
    resolution:
      integrity: project-integrity
snapshots:
  rolldown@1.2.0: {}
`

const environmentDocument = `lockfileVersion: '9.0'
importers:
  .:
    packageManagerDependencies:
      pnpm:
        specifier: 12.8.1
        version: 12.8.1
  environment-only:
    configDependencies: {}
packages:
  pnpm@12.8.1: {}
snapshots:
  pnpm@12.8.1: {}
`

it('reads legacy single-document project dependencies', () => {
  expect(parsePnpmLockfile(projectDocument)).toEqual({
    lockfileVersion: '9.0',
    importers: { '.': { dependencies: { rolldown: { specifier: '1.2.0', version: '1.2.0' } } } },
    packages: { 'rolldown@1.2.0': { resolution: { integrity: 'project-integrity' } } },
    snapshots: { 'rolldown@1.2.0': {} },
  })
})

it.each(['\n', '\r\n'])('excludes bootstrap dependencies from combined lockfiles with %j line endings', (lineEnding) => {
  const source = `\uFEFF---\n${environmentDocument}\n---\n${projectDocument}`.replaceAll('\n', lineEnding)
  expect(parsePnpmLockfile(source)).toEqual(parsePnpmLockfile(projectDocument))
})

it('accepts BOM and CRLF in legacy lockfiles', () => {
  expect(parsePnpmLockfile(`\uFEFF${projectDocument.replaceAll('\n', '\r\n')}`)).toEqual(parsePnpmLockfile(projectDocument))
})

it.each(['', `---\n${environmentDocument}`, `---\n${environmentDocument}\n---\n`])('rejects a lockfile without project dependencies: %j', (source) => {
  expect(() => parsePnpmLockfile(source)).toThrow('pnpm lockfile is empty')
})

it.each(['packages: [', '- invalid-project'])('rejects invalid project documents: %s', (project) => {
  expect(() => parsePnpmLockfile(`---\n${environmentDocument}\n---\n${project}`)).toThrow()
})

it('rejects an unexpected third document instead of silently dropping dependencies', () => {
  expect(() => parsePnpmLockfile(`---\n${environmentDocument}\n---\n${projectDocument}\n---\npackages: {}`)).toThrow()
})
