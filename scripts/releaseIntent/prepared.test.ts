import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 测试使用跨平台 pnpm.cmd 解析。
import { execa } from 'execa'
import { afterEach, describe, expect, it } from 'vitest'
import { collectPreparedReleasePackages } from '../check-publishable-workspace-changeset'
import { FixtureLifecycle } from '../verification/fixtureLifecycle'
import { readWorkflowFixture } from '../workflowFixture.mjs'

const fixtureTasks = new Set<FixtureLifecycle>()

afterEach(async () => {
  await Promise.all([...fixtureTasks].map(fixture => fixture.close()))
  fixtureTasks.clear()
})

describe('repoctl release preparation integration', () => {
  it('accepts native fixed/dependent preparation and rejects source edits on the release branch', ({ signal }) => {
    const lifecycle = new FixtureLifecycle(signal)
    fixtureTasks.add(lifecycle)
    return lifecycle.run(async () => {
      const cwd = await mkdtemp(path.join(tmpdir(), 'weapp-release-validation-'))
      const names = ['core', 'fixed', 'consumer']
      const requests: { method: string | undefined, path: string | undefined, host: string | undefined }[] = []
      const registry = createServer((request, response) => {
        requests.push({ method: request.method, path: request.url, host: request.headers.host })
        const name = request.url?.slice(1)
        response.setHeader('content-type', 'application/json')
        if (request.method !== 'GET' || !name || !names.includes(name)) {
          response.statusCode = 404
          response.end(JSON.stringify({ error: 'Unexpected fixture registry request' }))
          return
        }
        response.end(JSON.stringify({ name, 'dist-tags': { latest: '1.0.0' }, 'versions': { '1.0.0': { name, version: '1.0.0' } } }))
      })
      const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
      const write = async (file: string, text: string) => {
        await mkdir(path.dirname(path.join(cwd, file)), { recursive: true })
        await writeFile(path.join(cwd, file), text)
      }
      const errors: unknown[] = []
      try {
        await new Promise<void>((resolve, reject) => {
          registry.once('error', reject)
          registry.listen(0, '127.0.0.1', () => {
            registry.removeListener('error', reject)
            resolve()
          })
        })
        const address = registry.address()
        if (!address || typeof address === 'string') {
          throw new Error('Missing fixture registry address')
        }
        const registryUrl = new URL(`http://127.0.0.1:${address.port}`)
        const root = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as { packageManager: string }
        await write('package.json', JSON.stringify({ name: 'fixture', private: true, packageManager: root.packageManager }))
        await write('pnpm-workspace.yaml', 'packages: [packages/*]\nverifyDepsBeforeRun: false\nversioning:\n  fixed: [[core, fixed]]\n  changelog: {storage: repository}\n')
        await write('.changeset/change.md', '---\ncore: major\n---\n\nfeat!: 调整接口\n')
        for (const name of names) {
          await write(`packages/${name}/package.json`, JSON.stringify({
            name,
            version: '1.0.0',
            scripts: { preversion: 'node -e "throw new Error(\'must not execute candidate hooks\')"' },
            ...(name === 'consumer' ? { dependencies: { core: 'workspace:*' } } : {}),
          }))
        }
        git('init', '--quiet')
        git('config', 'user.name', 'Fixture')
        git('config', 'user.email', 'fixture@example.invalid')
        git('config', 'core.hooksPath', '.git/disabled-hooks')
        git('add', '.')
        git('commit', '--quiet', '-m', 'fixture')
        const base = git('rev-parse', 'HEAD')
        await execa('pnpm', [
          '--config.verify-deps-before-run=false',
          '--config.manage-package-manager-versions=false',
          '--config.pm-on-fail=ignore',
          '--config.runtime-on-fail=ignore',
          `--config.registry=${registryUrl.href}`,
          '--ignore-scripts',
          'version',
          '-r',
          '--json',
          '--no-git-checks',
        ], { cwd, timeout: 60_000, cancelSignal: lifecycle.signal })
        expect(new Set(requests.map(request => request.path))).toEqual(new Set(names.map(name => `/${name}`)))
        expect(requests.every(request => request.method === 'GET' && request.host === registryUrl.host)).toBe(true)
        git('add', '.')
        git('commit', '--quiet', '-m', 'prepare')
        const options = { cwd, base, head: git('rev-parse', 'HEAD'), headRef: 'release/pnpm-version' }
        expect(await collectPreparedReleasePackages(options)).toEqual(new Set(['consumer', 'core', 'fixed']))
        await write('packages/core/src/index.ts', 'export const feature = true\n')
        git('add', '.')
        git('commit', '--quiet', '-m', 'unexpected source')
        await expect(collectPreparedReleasePackages({ ...options, head: git('rev-parse', 'HEAD') })).rejects.toThrow('packages/core/src/index.ts')
        expect(await collectPreparedReleasePackages({ ...options, headRef: 'feature' })).toEqual(new Set())
      }
      catch (error) {
        errors.push(error)
      }
      finally {
        const closed = registry.listening
          ? new Promise<void>((resolve, reject) => {
              registry.close(error => error ? reject(error) : resolve())
              registry.closeAllConnections()
            })
          : Promise.resolve()
        const cleanup = await Promise.allSettled([closed, rm(cwd, { recursive: true, force: true })])
        errors.push(...cleanup.filter(result => result.status === 'rejected').map(result => result.reason))
      }
      if (errors.length === 1) {
        throw errors[0]
      }
      if (errors.length > 1) {
        throw new AggregateError(errors, 'Release preparation fixture failed')
      }
    })
  }, 60_000)

  it('keeps the package completeness check inside the existing gated policy jobs', () => {
    const workflow = readWorkflowFixture('validate-ci-policy.yml') as { jobs: Record<string, { with?: { main_command?: string } }> }
    for (const job of ['policy-pr', 'policy-full']) {
      expect(workflow.jobs[job]!.with?.main_command).toContain('pnpm check:publishable-workspace-changeset')
    }
  })
})
