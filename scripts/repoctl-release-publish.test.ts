import type { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { publishStable } from 'repoctl'
import { afterEach, expect, it, vi } from 'vitest'

const roots: string[] = []
const packages = [
  { name: '@release-fixture/first', version: '1.0.0' },
  { name: '@release-fixture/second', version: '2.0.0' },
]

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function createReleaseFixture() {
  const cwd = await mkdtemp(path.join(tmpdir(), 'repoctl-publish-'))
  roots.push(cwd)
  await writeFile(path.join(cwd, 'package.json'), JSON.stringify({ private: true }))
  await writeFile(path.join(cwd, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n')
  for (const [index, pkg] of packages.entries()) {
    const directory = path.join(cwd, 'packages', String(index))
    await mkdir(directory, { recursive: true })
    await writeFile(path.join(directory, 'package.json'), JSON.stringify(pkg))
  }
  const publishes: string[][] = []
  const visible = new Set<string>()
  const sleep = vi.fn(async (_milliseconds: number) => {})
  let onPublish = (_args: string[], _attempt: number) => ({ status: 0, stdout: '', stderr: '' })
  const spawn = ((command: string, args: string[]) => {
    if (command === 'npm' && args[0] === 'view') {
      const pkg = packages.find(pkg => `${pkg.name}@${pkg.version}` === args[1])
      return { status: pkg && visible.has(pkg.name) ? 0 : 1, stdout: pkg && visible.has(pkg.name) ? `${pkg.version}\n` : '', stderr: '' }
    }
    if (command === 'pnpm' && args[0] === 'publish') {
      publishes.push(args)
      return onPublish(args, publishes.length)
    }
    throw new Error(`Unexpected release command: ${command} ${args.join(' ')}`)
  }) as typeof spawnSync
  return {
    cwd,
    publishes,
    visible,
    sleep,
    setPublish(handler: typeof onPublish) { onPublish = handler },
    summary(entries = packages) {
      writeFileSync(path.join(cwd, 'pnpm-publish-summary.json'), JSON.stringify({ publishedPackages: entries }))
    },
    run: () => publishStable({ cwd, branch: 'main', config: { qualityScripts: [] }, spawn, sleep }),
  }
}

it('does not republish acknowledged uploads while npm metadata is delayed after an OIDC failure', async () => {
  const fixture = await createReleaseFixture()
  fixture.setPublish((args, attempt) => {
    if (attempt === 1) {
      // pnpm 12.5.1 在递归发布失败时没有写入部分成功的 summary。
      return { status: 1, stdout: `✅ Published package ${packages[0].name}@1.0.0\r\n`, stderr: 'ERR_PNPM_ID_TOKEN_GITHUB_INVALID_RESPONSE: 503\nFailed to publish package: 404 Not Found' }
    }
    expect(args.filter((_, index) => args[index - 1] === '--filter')).toEqual([packages[1].name])
    fixture.summary([packages[1]])
    packages.forEach(pkg => fixture.visible.add(pkg.name))
    return { status: 0, stdout: '', stderr: '' }
  })

  expect(await fixture.run()).toEqual(expect.arrayContaining(packages))
  expect(fixture.publishes).toHaveLength(2)
})

it('uses partial summaries and keeps them when a later retry fails permanently', async () => {
  const fixture = await createReleaseFixture()
  fixture.setPublish((args, attempt) => {
    if (attempt === 1) {
      fixture.summary([packages[0]])
      return { status: 1, stdout: '', stderr: '503 Service Unavailable' }
    }
    expect(args.filter((_, index) => args[index - 1] === '--filter')).toEqual([packages[1].name])
    fixture.summary([])
    return { status: 1, stdout: '', stderr: 'E403 Forbidden' }
  })

  await expect(fixture.run()).rejects.toThrow('command failed:')
  expect(JSON.parse(await readFile(path.join(fixture.cwd, 'pnpm-publish-summary.json'), 'utf8'))).toEqual({ publishedPackages: [packages[0]] })
  expect(fixture.publishes).toHaveLength(2)
})

it('refreshes registry state after backoff before retrying a staged conflict', async () => {
  const fixture = await createReleaseFixture()
  fixture.setPublish((_args, attempt) => {
    if (attempt === 1) {
      return { status: 1, stdout: '', stderr: '409 Conflict: Cannot publish over previously staged version' }
    }
    throw new Error('Versions that became visible during backoff must not be republished')
  })
  fixture.sleep.mockImplementation(async () => {
    packages.forEach(pkg => fixture.visible.add(pkg.name))
  })

  expect(await fixture.run()).toEqual(expect.arrayContaining(packages))
  expect(fixture.publishes).toHaveLength(1)
})

it('waits for acknowledged uploads to become visible without uploading them again', async () => {
  const fixture = await createReleaseFixture()
  fixture.setPublish(() => ({ status: 1, stdout: packages.map(pkg => `✅ Published package ${pkg.name}@${pkg.version}`).join('\n'), stderr: '503' }))
  fixture.sleep.mockImplementation(async () => {
    packages.forEach(pkg => fixture.visible.add(pkg.name))
  })

  expect(await fixture.run()).toEqual(expect.arrayContaining(packages))
  expect(fixture.publishes).toHaveLength(1)
  expect(fixture.sleep).toHaveBeenCalledTimes(1)
})

it('fails explicitly if acknowledged uploads never become visible', async () => {
  const fixture = await createReleaseFixture()
  fixture.setPublish(() => ({ status: 1, stdout: packages.map(pkg => `✅ Published package ${pkg.name}@${pkg.version}`).join('\n'), stderr: '503' }))

  await expect(fixture.run()).rejects.toThrow('not yet visible in the registry')
  expect(fixture.publishes).toHaveLength(1)
  expect(fixture.sleep).toHaveBeenCalledTimes(5)
  expect(JSON.parse(await readFile(path.join(fixture.cwd, 'pnpm-publish-summary.json'), 'utf8'))).toEqual({ publishedPackages: packages })
})

it.each(['E403 Forbidden', '404 Not Found'])('does not retry permanent failures: %s', async (stderr) => {
  const fixture = await createReleaseFixture()
  fixture.setPublish(() => ({ status: 1, stdout: '', stderr }))

  await expect(fixture.run()).rejects.toThrow('command failed:')
  expect(fixture.publishes).toHaveLength(1)
  expect(fixture.sleep).not.toHaveBeenCalled()
})

it('does not accept another version or an attempted upload as an acknowledgement', async () => {
  const fixture = await createReleaseFixture()
  fixture.setPublish(() => ({
    status: 1,
    stdout: `✅ Published package ${packages[0].name}@0.9.0\n📦 ${packages[1].name}@2.0.0 → registry\n`,
    stderr: '503 Service Unavailable',
  }))

  await expect(fixture.run()).rejects.toThrow('command failed after 3 publish attempts')
  expect(fixture.publishes).toHaveLength(3)
  expect(fixture.publishes[2].filter((_, index) => fixture.publishes[2][index - 1] === '--filter')).toEqual(packages.map(pkg => pkg.name))
})

it('preserves ordinary successful publishing and its summary', async () => {
  const fixture = await createReleaseFixture()
  fixture.setPublish(() => {
    fixture.summary()
    return { status: 0, stdout: '', stderr: '' }
  })

  expect(await fixture.run()).toEqual(packages)
  expect(fixture.publishes).toHaveLength(1)
  expect(fixture.sleep).not.toHaveBeenCalled()
})
