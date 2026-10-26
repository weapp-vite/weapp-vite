import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'

/** 提供不可变 GitHub 元数据，测试仓库 JSON 策略与正式引擎的接入。 */
export function changesetFixture(policy, { files = ['packages-runtime/wevu/src/index.ts'], title = 'fix: 修复生命周期', labels = [] } = {}) {
  const head = 'a'.repeat(40)
  const base = 'b'.repeat(40)
  const treeSha = 'c'.repeat(40)
  const repository = { id: 1, full_name: 'example/repo', default_branch: 'main' }
  const manifests = {
    'package.json': { name: 'fixture', private: true },
    'packages/create-weapp-vite/package.json': { name: 'create-weapp-vite', version: '1.0.0' },
    'packages-runtime/wevu/package.json': { name: 'wevu', version: '1.0.0', dependencies: { '@weapp-core/constants': 'workspace:*' } },
    '@weapp-core/constants/package.json': { name: '@weapp-core/constants', version: '1.0.0' },
    'mpcore/packages/simulator/package.json': { name: '@mpcore/simulator', version: '1.0.0' },
    'mpcore/packages/test/package.json': { name: '@mpcore/test', version: '1.0.0' },
    'packages/aliased/package.json': { name: 'aliased', version: '1.0.0', optionalDependencies: { shared: 'npm:@weapp-core/constants@1.0.0' } },
    'packages/relative/package.json': { name: 'relative', version: '1.0.0', devDependencies: { shared: 'workspace:../../@weapp-core/constants' } },
    'templates/vue/package.json': { name: 'template-vue', private: true },
  }
  const data = {
    ...Object.fromEntries(Object.entries(manifests).map(([file, manifest]) => [file, JSON.stringify(manifest)])),
    'pnpm-workspace.yaml': 'packages: [packages/*, packages-runtime/*, mpcore/packages/*, "@weapp-core/*", templates/*]\n',
    '.github/repoctl-auto-changeset.json': JSON.stringify(policy),
  }
  const blobs = new Map()
  const tree = Object.entries(data).map(([path, content]) => {
    const bytes = Buffer.from(content)
    const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
    blobs.set(sha, { sha, encoding: 'base64', size: bytes.length, content: bytes.toString('base64') })
    return { path, sha, type: 'blob', mode: '100644' }
  })
  const routes = new Map([
    ['', repository],
    ['/pulls/1', {
      number: 1,
      state: 'open',
      draft: false,
      changed_files: files.length,
      title,
      labels: labels.map(name => ({ name })),
      head: { ref: 'feature', sha: head, repo: repository },
      base: { ref: 'main', sha: base, repo: repository },
    }],
    ['/issues/1/labels', labels.map(name => ({ name }))],
    ['/git/ref/heads/main', { object: { sha: base } }],
    ['/pulls/1/files', files.map(filename => ({ filename, status: 'modified' }))],
    [`/git/commits/${head}`, { sha: head, tree: { sha: treeSha } }],
    [`/git/commits/${base}`, { sha: base, tree: { sha: treeSha } }],
    [`/git/trees/${treeSha}`, { sha: treeSha, truncated: false, tree }],
    ...[...blobs].map(([sha, value]) => [`/git/blobs/${sha}`, value]),
  ])
  return {
    repository: repository.full_name,
    pullRequest: 1,
    policyPath: '.github/repoctl-auto-changeset.json',
    token: 'fixture-token',
    env: {},
    fetch: async (input, init) => {
      if (init?.method && init.method !== 'GET') {
        throw new Error('Policy tests must never mutate GitHub')
      }
      const route = new URL(String(input)).pathname.replace('/repos/example/repo', '')
      if (!routes.has(route)) {
        throw new Error(`Unexpected GitHub fixture request: ${route}`)
      }
      return Response.json(routes.get(route))
    },
  }
}
