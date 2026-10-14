import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'

interface PackageManifest {
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

const core = JSON.parse(await readFile(new URL('../../../../package.json', import.meta.url), 'utf8')) as PackageManifest
const dashboard = JSON.parse(await readFile(new URL('../../../../../dashboard/package.json', import.meta.url), 'utf8')) as PackageManifest
const transportPackages = ['@devframes/agentic', '@devframes/hub', '@devframes/hub-ui']

it.each(transportPackages)('does not install the inactive Dashboard transport %s with core', (name) => {
  expect(core.dependencies?.[name]).toBeUndefined()
  expect(core.optionalDependencies?.[name]).toBeUndefined()
})

it.each(transportPackages)('installs %s with the optional Dashboard owner', (name) => {
  expect(dashboard.dependencies?.[name]).toEqual(expect.any(String))
  expect(dashboard.dependencies?.[name]).toBe(core.devDependencies?.[name])
})
