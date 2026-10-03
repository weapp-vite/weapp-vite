import type { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { prepareStable } from 'repoctl'
import { execSync } from 'tinyexec'
import { afterEach, describe, expect, it } from 'vitest'

interface Manifest {
  name: string
  version?: string
  private?: boolean
  dependencies?: Record<string, string>
}

interface AppliedVersion {
  name: string
  currentVersion: string
  newVersion: string
}

const roots: string[] = []
const publicName = '@release-fixture/library'
const privateName = '@release-fixture/demo'
const rootName = '@release-fixture/root'

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function createPreparationFixture() {
  const cwd = await mkdtemp(path.join(tmpdir(), 'repoctl-prepare-'))
  roots.push(cwd)
  const manifests: Record<string, Manifest> = {
    'package.json': { name: rootName, private: true, version: '1.0.0' },
    'packages/library/package.json': { name: publicName, version: '1.0.0' },
    'packages/demo/package.json': {
      name: privateName,
      private: true,
      version: '1.0.0',
      dependencies: { [publicName]: 'workspace:*' },
    },
    'packages/tool/package.json': { name: '@release-fixture/tool', private: true },
  }
  for (const [file, manifest] of Object.entries(manifests)) {
    await mkdir(path.dirname(path.join(cwd, file)), { recursive: true })
    await writeFile(path.join(cwd, file), JSON.stringify(manifest))
  }
  await writeFile(path.join(cwd, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n')
  await mkdir(path.join(cwd, '.changeset'))
  await writeFile(path.join(cwd, '.changeset/update.md'), `---\n"${publicName}": patch\n"${privateName}": patch\n"${rootName}": patch\n---\n\n发布测试。\n`)
  const hooks: string[] = []
  const versionCalls: string[][] = []
  let version = () => ({ status: 0, stdout: '[]', stderr: '' })
  const spawn = ((command: string, args: string[]) => {
    if (command === 'pnpm' && args[0] === 'version') {
      versionCalls.push(args)
      return version()
    }
    if (command === 'pnpm' && args[0] === 'run') {
      hooks.push(args[1])
      return { status: 0, stdout: '', stderr: '' }
    }
    if (command === 'git' && args.join(' ') === 'diff --quiet --exit-code') {
      return { status: 1, stdout: '', stderr: '' }
    }
    throw new Error(`Unexpected preparation command: ${command} ${args.join(' ')}`)
  }) as typeof spawnSync
  return {
    cwd,
    hooks,
    versionCalls,
    apply(entries: AppliedVersion[]) {
      for (const entry of entries) {
        const match = Object.entries(manifests).find(([, manifest]) => manifest.name === entry.name)
        if (match) {
          writeFileSync(path.join(cwd, match[0]), JSON.stringify({ ...match[1], version: entry.newVersion }))
        }
      }
    },
    setVersion(handler: typeof version) { version = handler },
    async manifest(file: string) {
      return JSON.parse(await readFile(path.join(cwd, file), 'utf8')) as Manifest
    },
    run: () => prepareStable({
      cwd,
      branch: 'main',
      config: { qualityScripts: [], hooks: { afterVersion: ['after-version'] } },
      spawn,
    }),
  }
}

function bump(name: string): AppliedVersion {
  return { name, currentVersion: '1.0.0', newVersion: '1.0.1' }
}

describe('repoctl release preparation workspace boundary', () => {
  it('validates actual pnpm version output for private packages and the versioned root', async () => {
    const fixture = await createPreparationFixture()
    let applied: AppliedVersion[] = []
    fixture.setVersion(() => {
      const result = execSync('pnpm', ['version', '-r', '--no-git-checks', '--json'], { nodeOptions: { cwd: fixture.cwd }, timeout: 20_000 })
      if (result.exitCode === 0) {
        applied = JSON.parse(result.stdout) as AppliedVersion[]
      }
      return { status: result.exitCode ?? 1, stdout: result.stdout, stderr: result.stderr }
    })

    await expect(fixture.run()).resolves.toBe(true)
    expect(applied).toEqual(expect.arrayContaining([bump(privateName), bump(rootName)]))
    expect(applied.some(entry => entry.name === publicName)).toBe(true)
    expect(await fixture.manifest('packages/demo/package.json')).toMatchObject({ private: true, version: '1.0.1' })
    expect(await fixture.manifest('package.json')).toMatchObject({ private: true, version: '1.0.1' })
    expect(await fixture.manifest('packages/tool/package.json')).not.toHaveProperty('version')
    expect(fixture.hooks).toEqual(['after-version'])
    expect(fixture.versionCalls).toEqual([['version', '-r', '--no-git-checks', '--json']])
  }, 30_000)

  it('accepts public dependency propagation together with a private dependent', async () => {
    const fixture = await createPreparationFixture()
    const entries = [bump(publicName), bump(privateName)]
    fixture.setVersion(() => {
      fixture.apply(entries)
      return { status: 0, stdout: JSON.stringify(entries), stderr: '' }
    })

    await expect(fixture.run()).resolves.toBe(true)
    expect(fixture.hooks).toEqual(['after-version'])
  })

  it.each([publicName, privateName, rootName])('rejects a reported version that was not written for %s', async (name) => {
    const fixture = await createPreparationFixture()
    fixture.setVersion(() => ({ status: 0, stdout: JSON.stringify([bump(name)]), stderr: '' }))

    await expect(fixture.run()).rejects.toThrow('pnpm version result does not match workspace manifests')
    expect(fixture.hooks).toEqual([])
  })

  it.each([publicName, privateName, rootName])('rejects an omitted manifest update for %s', async (name) => {
    const fixture = await createPreparationFixture()
    fixture.setVersion(() => {
      fixture.apply([bump(name)])
      return { status: 0, stdout: '[]', stderr: '' }
    })

    await expect(fixture.run()).rejects.toThrow(`pnpm version omitted changed package ${name}`)
    expect(fixture.hooks).toEqual([])
  })

  it.each(['unknown', 'duplicate', 'wrong-current'] as const)('rejects %s entries without running afterVersion', async (kind) => {
    const fixture = await createPreparationFixture()
    fixture.setVersion(() => {
      fixture.apply([bump(privateName)])
      const entry = bump(privateName)
      const entries = kind === 'duplicate'
        ? [entry, entry]
        : [{ ...entry, ...(kind === 'unknown' ? { name: '@release-fixture/missing' } : { currentVersion: '0.9.0' }) }]
      return { status: 0, stdout: JSON.stringify(entries), stderr: '' }
    })

    await expect(fixture.run()).rejects.toThrow('pnpm version result does not match workspace manifests')
    expect(fixture.hooks).toEqual([])
  })
})
