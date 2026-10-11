import { GitHubClient } from 'repoctl'
import { describe, expect, it, vi } from 'vitest'

interface GitHubRequest {
  method: string
  url: URL
  body?: Record<string, unknown>
}

interface GitHubReply {
  body: unknown
  status?: number
}

const repository = 'release-fixture/repository'
const options = {
  head: 'repoctl-release/main',
  base: 'main',
  title: 'chore(release): 更新包版本',
  body: '发布说明已更新。',
}
const existing = {
  number: 7,
  html_url: 'https://example.test/release-fixture/repository/pull/7',
  state: 'open',
  title: '旧标题',
  body: '旧正文',
}

function createClient(replies: GitHubReply[]) {
  const requests: GitHubRequest[] = []
  const requestFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({
      method: init?.method ?? 'GET',
      url: new URL(typeof input === 'string' || input instanceof URL ? input : input.url),
      ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) as Record<string, unknown> } : {}),
    })
    const reply = replies[requests.length - 1]
    if (!reply) {
      throw new Error('Unexpected mocked GitHub request')
    }
    return Response.json(reply.body, { status: reply.status ?? 200 })
  })
  const client = new GitHubClient({
    token: 'fixture-token',
    repository,
    apiUrl: 'https://api.example.test',
    fetch: requestFetch,
    retryAttempts: 1,
  })
  return { client, requests }
}

describe('repoctl GitHub release pull request upsert', () => {
  it('finds the open PR by qualified head and base, then updates only its title and body', async () => {
    const { client, requests } = createClient([
      { body: [existing] },
      { body: { ...existing, title: options.title, body: options.body } },
    ])

    await client.ensurePullRequest(options)

    expect(requests).toHaveLength(2)
    const lookup = requests[0]!
    expect(lookup.method).toBe('GET')
    expect(lookup.url.origin).toBe('https://api.example.test')
    expect(lookup.url.pathname).toBe(`/repos/${repository}/pulls`)
    expect(Object.fromEntries(lookup.url.searchParams)).toEqual({
      state: 'open',
      head: `release-fixture:${options.head}`,
      base: options.base,
      per_page: '10',
    })
    const update = requests[1]!
    expect(update.method).toBe('PATCH')
    expect(update.url.pathname).toBe(`/repos/${repository}/pulls/${existing.number}`)
    expect(update.body).toEqual({ title: options.title, body: options.body })
  })

  it.each(['title', 'body'] as const)('updates a changed %s without retargeting or reopening the PR', async (field) => {
    const current = { ...existing, title: options.title, body: options.body, [field]: `旧${field}` }
    const { client, requests } = createClient([
      { body: [current] },
      { body: { ...current, [field]: options[field] } },
    ])

    await client.ensurePullRequest(options)

    expect(requests.map(request => request.method)).toEqual(['GET', 'PATCH'])
    const update = requests[1]!
    expect(update.body).toHaveProperty(field, options[field])
    expect(update.body).not.toHaveProperty('base')
    expect(update.body).not.toHaveProperty('state')
    expect(update.body).not.toHaveProperty('head')
    expect(update.url.pathname).toBe(`/repos/${repository}/pulls/${existing.number}`)
  })

  it.each([
    { label: 'nonempty body', storedBody: options.body, requestedBody: options.body },
    { label: 'empty body', storedBody: '', requestedBody: '' },
    { label: 'null body', storedBody: null, requestedBody: '' },
  ])('does not PATCH an unchanged PR with $label', async ({ storedBody, requestedBody }) => {
    const current = { ...existing, title: options.title, body: storedBody }
    const { client, requests } = createClient([{ body: [current] }])

    await expect(client.ensurePullRequest({ ...options, body: requestedBody })).resolves.toEqual(current)

    expect(requests.map(request => request.method)).toEqual(['GET'])
  })

  it('creates a missing PR with the requested head, base, title and body', async () => {
    const created = { ...existing, title: options.title, body: options.body }
    const { client, requests } = createClient([
      { body: [] },
      { body: created, status: 201 },
    ])

    await expect(client.ensurePullRequest(options)).resolves.toEqual(created)

    expect(requests.map(request => request.method)).toEqual(['GET', 'POST'])
    expect(requests[1]!.url.pathname).toBe(`/repos/${repository}/pulls`)
    expect(requests[1]!.body).toEqual(options)
  })

  it('preserves a qualified head when looking up an existing PR', async () => {
    const current = { ...existing, title: options.title, body: options.body }
    const { client, requests } = createClient([{ body: [current] }])

    await client.ensurePullRequest({ ...options, head: 'release-owner:repoctl-release/main' })

    expect(requests[0]!.url.searchParams.get('head')).toBe('release-owner:repoctl-release/main')
    expect(requests.map(request => request.method)).toEqual(['GET'])
  })

  it('fails a denied lookup without creating or updating another PR', async () => {
    const { client, requests } = createClient([{ body: { message: 'Forbidden' }, status: 403 }])

    await expect(client.ensurePullRequest(options)).rejects.toThrow('failed (403): Forbidden')

    expect(requests.map(request => request.method)).toEqual(['GET'])
  })

  it('fails a denied update without falling back to PR creation or another PR', async () => {
    const { client, requests } = createClient([
      { body: [existing] },
      { body: { message: 'Forbidden' }, status: 403 },
    ])

    await expect(client.ensurePullRequest(options)).rejects.toThrow('failed (403): Forbidden')

    expect(requests.map(request => request.method)).toEqual(['GET', 'PATCH'])
    expect(requests[1]!.url.pathname).toBe(`/repos/${repository}/pulls/${existing.number}`)
  })

  it('fails denied creation without updating another PR', async () => {
    const { client, requests } = createClient([
      { body: [] },
      { body: { message: 'Forbidden' }, status: 403 },
    ])

    await expect(client.ensurePullRequest(options)).rejects.toThrow('failed (403): Forbidden')

    expect(requests.map(request => request.method)).toEqual(['GET', 'POST'])
  })
})
