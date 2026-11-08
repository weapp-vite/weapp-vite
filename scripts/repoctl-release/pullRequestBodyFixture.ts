import { writeFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { GitHubClient } from 'repoctl'
import { vi } from 'vitest'
import { bump, createPreparationFixture, publicName } from './preparation'

export const bodyLimit = 65_536
export const versionCommit = 'a'.repeat(40)
export const repository = 'release-fixture/repository'
export const serverUrl = 'https://github.example.test'

export interface BodyRequest {
  method: string
  pathname: string
  body?: Record<string, unknown>
}

export async function createPullRequestBodyFixture(summary: string, options: { extraPackages?: boolean, existing?: boolean, packageCount?: number } = {}) {
  const fixture = await createPreparationFixture()
  const packages = [
    { name: publicName, directory: 'packages/library' },
    ...(options.extraPackages
      ? [{ name: '@release-fixture/extra', directory: 'packages/feature notes' }, { name: '@release-fixture/another', directory: 'packages/another' }]
      : []),
    ...Array.from({ length: Math.max(0, (options.packageCount ?? 1) - 1) }, (_, index) => ({
      name: `@release-fixture/overflow-${index}-${'p'.repeat(100)}`,
      directory: `packages/overflow-${index}`,
    })),
  ]
  for (const pkg of packages.slice(1)) {
    await mkdir(path.join(fixture.cwd, pkg.directory), { recursive: true })
    await writeFile(path.join(fixture.cwd, pkg.directory, 'package.json'), JSON.stringify({ name: pkg.name, version: '1.0.0' }))
  }
  const apply = fixture.apply
  // 在 pnpm version 的同步边界准备完整清单与 changelog，避免真实网络或发布操作。
  fixture.setVersion(() => {
    const releases = packages.map(pkg => bump(pkg.name))
    apply(releases)
    for (const pkg of packages) {
      writeFileSync(path.join(fixture.cwd, pkg.directory, 'package.json'), JSON.stringify({ name: pkg.name, version: '1.0.1' }))
      writeFileSync(path.join(fixture.cwd, pkg.directory, 'CHANGELOG.md'), `# ${pkg.name}\n\n## 1.0.1\n\n### Patch Changes\n\n- ${summary}\n`)
    }
    return { status: 0, stdout: JSON.stringify(releases), stderr: '' }
  })
  const requests: BodyRequest[] = []
  const existing = { number: 7, html_url: `${serverUrl}/${repository}/pull/7`, state: 'open', title: '旧发布说明', body: '旧正文' }
  const requestFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
    const method = init?.method ?? 'GET'
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : undefined
    requests.push({ method, pathname: url.pathname, ...(body ? { body } : {}) })
    if (method === 'GET') {
      return Response.json(options.existing ? [existing] : [])
    }
    if (typeof body?.body !== 'string') {
      throw new TypeError('Expected the real GitHub client to send a PR body')
    }
    if (Array.from(body.body).length > bodyLimit) {
      return Response.json({ message: 'Validation Failed', errors: [{ resource: 'PullRequest', field: 'body', code: 'custom', message: 'body is too long (maximum is 65536 characters)' }] }, { status: 422 })
    }
    return Response.json({ ...existing, ...body }, { status: method === 'POST' ? 201 : 200 })
  })
  const client = new GitHubClient({ token: 'fixture-token', repository, apiUrl: 'https://api.example.test', fetch: requestFetch, retryAttempts: 1 })
  fixture.github.ensurePullRequest.mockImplementation((input: Parameters<GitHubClient['ensurePullRequest']>[0]) => client.ensurePullRequest(input))
  return {
    ...fixture,
    packages,
    requests,
    body() {
      const request = requests.find(entry => entry.method === (options.existing ? 'PATCH' : 'POST'))
      if (typeof request?.body?.body !== 'string') {
        throw new TypeError('No PR body reached the GitHub boundary')
      }
      return request.body.body
    },
    changelog: (directory: string) => readFile(path.join(fixture.cwd, directory, 'CHANGELOG.md'), 'utf8'),
  }
}
