import { afterEach, describe, expect, it, vi } from 'vitest'
import { authenticatePrContextArtifact, readVerifiedPrContext } from '../.github/scripts/pr-context-provenance.mjs'
import { downloadPrContext } from '../.github/scripts/resolve-performance-runs.mjs'

const repository = 'example/project'
const driverSha = 'a'.repeat(40)
const digest = 'b'.repeat(64)
const checkout = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'
const upload = 'actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9'
const run = { id: 123, run_attempt: 1, event: 'workflow_dispatch', head_branch: 'main', head_sha: driverSha, head_repository: { full_name: repository, id: 2 }, repository: { id: 1 } }
const artifact = { id: 456, name: 'pr-context', expired: false, digest: `sha256:${digest}`, workflow_run: { id: run.id, head_sha: driverSha, head_branch: 'main', repository_id: 1, head_repository_id: 2 } }
const job = {
  id: 789,
  name: 'pr-context / resolve',
  run_id: run.id,
  run_attempt: 1,
  head_sha: driverSha,
  status: 'completed',
  conclusion: 'success',
  steps: [`Run ${checkout}`, 'Run node .github/scripts/pr-context.mjs', `Run ${upload}`].map((name, index) => ({ name, number: index + 2, status: 'completed', conclusion: 'success' })),
}
const log = [
  `Uses: ${repository}/.github/workflows/reusable-pr-context.yml@refs/heads/main (${driverSha})`,
  `##[group]Run ${checkout}`,
  `  ref: ${driverSha}`,
  `  repository: ${repository}`,
  '##[endgroup]',
  '[command]/usr/bin/git log -1 --format=%H',
  driverSha,
  '##[group]Run node .github/scripts/pr-context.mjs',
  '##[endgroup]',
  `##[group]Run ${upload}`,
  '  name: pr-context',
  '  path: .tmp/pr-context/context.json',
  '##[endgroup]',
  `SHA256 digest of uploaded artifact is ${digest}`,
  'Artifact pr-context successfully finalized. Artifact ID 456',
  'Artifact pr-context has been successfully uploaded! Final size is 415 bytes. Artifact ID is 456',
  `Artifact download URL: https://github.com/${repository}/actions/runs/123/artifacts/456`,
  'Post job cleanup.',
].map(line => `2026-01-01T00:00:01.1234567Z ${line}`).join('\r\n')
const context = {
  schemaVersion: 1,
  repository,
  runId: String(run.id),
  driverSha,
  isPr: true,
  shouldRun: true,
  prNumber: 42,
  headSha: 'c'.repeat(40),
  baseSha: 'd'.repeat(40),
  checkoutSha: 'e'.repeat(40),
  checkoutMode: 'merge',
  headRef: 'feature/change',
  baseRef: 'main',
  headRepository: 'contributor/project',
}

function optionsFor({ source = run, candidate = artifact, jobs = [job], logs = log } = {}) {
  const request = vi.fn(async (pathname, options) => {
    if (pathname.includes('/artifacts?')) {
      return { artifacts: [candidate], total_count: 1 }
    }
    if (pathname.includes('/jobs?')) {
      return { jobs }
    }
    if (pathname.endsWith('/logs') && options?.responseType === 'text') {
      return logs
    }
    throw new Error(`Unexpected request ${pathname}`)
  })
  return { apiUrl: 'https://api.example.test', token: 'test-only', repository, run: source, artifact: candidate, defaultBranch: 'main', request }
}

afterEach(() => vi.unstubAllGlobals())

describe('trusted PR context artifact provenance', () => {
  it('authenticates immutable artifact ID and digest against the dedicated driver resolver job', async () => {
    const options = optionsFor()
    expect(await authenticatePrContextArtifact(options)).toEqual({ artifact, runAttempt: 1, jobId: 789 })
    expect(options.request).toHaveBeenCalledWith(`/repos/${repository}/actions/jobs/789/logs`, { responseType: 'text' })
  })

  it('downloads the exact authenticated artifact without reselecting by name', async () => {
    const options = optionsFor()
    const download = vi.fn().mockResolvedValue(context)
    expect(await readVerifiedPrContext({ ...options, download })).toBe(context)
    expect(download).toHaveBeenCalledWith(expect.objectContaining({ artifact, run }))
  })

  it.each([
    { id: 457 },
    { digest: `sha256:${'f'.repeat(64)}` },
    { name: 'other' },
    { expired: true },
    { workflow_run: { ...artifact.workflow_run, id: 124 } },
    { workflow_run: { ...artifact.workflow_run, head_sha: 'f'.repeat(40) } },
    { workflow_run: { ...artifact.workflow_run, head_repository_id: 3 } },
  ])('rejects replacement, foreign or invalid artifact %j', async (change) => {
    await expect(authenticatePrContextArtifact(optionsFor({ candidate: { ...artifact, ...change } }))).rejects.toMatchObject({ code: 'PR_CONTEXT_UNTRUSTED' })
  })

  it.each([
    { event: 'pull_request' },
    { head_branch: 'feature' },
    { head_repository: { full_name: 'attacker/project' } },
  ])('requires a trusted default-branch manual driver %j', async (change) => {
    const options = optionsFor({ source: { ...run, ...change } })
    await expect(authenticatePrContextArtifact(options)).rejects.toMatchObject({ code: 'PR_CONTEXT_UNTRUSTED' })
    expect(options.request).not.toHaveBeenCalled()
  })

  it.each([
    { name: 'Build and Test / run' },
    { conclusion: 'failure' },
    { status: 'in_progress' },
    { run_id: 124 },
    { head_sha: 'f'.repeat(40) },
    { steps: job.steps.map(step => step.name.startsWith(`Run ${upload}`) ? { ...step, conclusion: 'failure' } : step) },
    { steps: [...job.steps, job.steps[2]] },
    { steps: job.steps.map(step => ({ ...step, number: 1 })) },
  ])('rejects candidate jobs and unsuccessful or ambiguous resolver/upload steps %j', async (change) => {
    await expect(authenticatePrContextArtifact(optionsFor({ jobs: [{ ...job, ...change }] }))).rejects.toMatchObject({ code: 'PR_CONTEXT_UNTRUSTED' })
  })

  it.each([
    [`refs/heads/main (${driverSha})`, `refs/heads/feature (${driverSha})`],
    [`  ref: ${driverSha}`, '  ref: feature/change'],
    [`  repository: ${repository}`, '  repository: attacker/project'],
    ['git log -1 --format=%H', 'git status'],
    [`SHA256 digest of uploaded artifact is ${digest}`, 'SHA256 digest of uploaded artifact is different'],
    ['/runs/123/artifacts/456', '/runs/124/artifacts/456'],
    ['Artifact ID 456', 'Artifact ID 457'],
    ['  name: pr-context', '  name: other'],
  ])('rejects altered trusted upload log %s', async (from, to) => {
    await expect(authenticatePrContextArtifact(optionsFor({ logs: log.replace(from, to) }))).rejects.toMatchObject({ code: 'PR_CONTEXT_UNTRUSTED' })
  })

  it('accepts a default-branch checkout that advanced beyond the reusable driver commit', async () => {
    const checkoutSha = 'f'.repeat(40)
    const currentMain = log.replace(`  ref: ${driverSha}`, '  ref: main')
      .replace(`--format=%H\r\n2026-01-01T00:00:01.1234567Z ${driverSha}`, `--format=%H\r\n2026-01-01T00:00:01.1234567Z ${checkoutSha}`)
    expect(await authenticatePrContextArtifact(optionsFor({ logs: currentMain }))).toMatchObject({ artifact, runAttempt: 1 })
  })

  it('rejects invalid checkout SHAs and mismatches when checkout pins the driver SHA', async () => {
    for (const checkoutSha of ['not-a-sha', 'f'.repeat(40)]) {
      const altered = log.replace(`--format=%H\r\n2026-01-01T00:00:01.1234567Z ${driverSha}`, `--format=%H\r\n2026-01-01T00:00:01.1234567Z ${checkoutSha}`)
      await expect(authenticatePrContextArtifact(optionsFor({ logs: altered }))).rejects.toMatchObject({ code: 'PR_CONTEXT_UNTRUSTED' })
      if (checkoutSha === 'not-a-sha') {
        await expect(authenticatePrContextArtifact(optionsFor({ logs: altered.replace(`  ref: ${driverSha}`, '  ref: main') }))).rejects.toMatchObject({ code: 'PR_CONTEXT_UNTRUSTED' })
      }
    }
  })

  it('rejects an artifact ID or digest printed outside the trusted upload step', async () => {
    const spoofed = log.replace('Post job cleanup.', `Post job cleanup.\r\n${log}`)
      .replace(`SHA256 digest of uploaded artifact is ${digest}`, 'no digest here')
    await expect(authenticatePrContextArtifact(optionsFor({ logs: spoofed }))).rejects.toMatchObject({ code: 'PR_CONTEXT_UNTRUSTED' })
  })

  it('accepts original resolver artifacts during rerun-failed-jobs', async () => {
    const options = optionsFor({ source: { ...run, run_attempt: 2 } })
    expect(await readVerifiedPrContext({ ...options, download: vi.fn().mockResolvedValue(context) })).toBe(context)
  })

  it('requires context runAttempt to match the resolver that actually uploaded it', async () => {
    const options = optionsFor({ source: { ...run, run_attempt: 2 }, jobs: [{ ...job, run_attempt: 2 }] })
    await expect(readVerifiedPrContext({ ...options, download: vi.fn().mockResolvedValue(context) })).rejects.toMatchObject({ code: 'PR_CONTEXT_UNTRUSTED' })
    expect(await readVerifiedPrContext({ ...options, download: vi.fn().mockResolvedValue({ ...context, runAttempt: 2 }) })).toMatchObject({ runAttempt: 2 })
  })

  it('paginates job metadata and rejects duplicate resolver jobs in one attempt', async () => {
    const options = optionsFor()
    options.request.mockImplementation(async (pathname, requestOptions) => {
      if (pathname.endsWith('page=1')) {
        return { jobs: Array.from({ length: 100 }, () => ({ ...job, name: 'Other job' })) }
      }
      if (pathname.endsWith('page=2')) {
        return { jobs: [job] }
      }
      if (requestOptions?.responseType === 'text') {
        return log
      }
      throw new Error('Unexpected request')
    })
    expect(await authenticatePrContextArtifact(options)).toMatchObject({ jobId: 789 })
    await expect(authenticatePrContextArtifact(optionsFor({ jobs: [job, { ...job, id: 790 }] }))).rejects.toMatchObject({ code: 'PR_CONTEXT_UNTRUSTED' })
  })

  it('distinguishes missing artifacts from ambiguous artifacts and API failures', async () => {
    const options = optionsFor()
    options.request.mockResolvedValue({ artifacts: [] })
    await expect(readVerifiedPrContext(options)).rejects.toMatchObject({ code: 'PR_CONTEXT_MISSING' })
    options.request.mockResolvedValue({ artifacts: [artifact, artifact] })
    await expect(readVerifiedPrContext(options)).rejects.toMatchObject({ code: 'PR_CONTEXT_UNTRUSTED' })
    options.request.mockRejectedValue(new Error('API unavailable'))
    await expect(readVerifiedPrContext(options)).rejects.toThrow('API unavailable')
  })

  it('fails closed when resolver logs have expired or context identity is forged', async () => {
    const options = optionsFor()
    await expect(readVerifiedPrContext({ ...options, readJobLog: vi.fn().mockRejectedValue(new Error('Logs expired')), download: vi.fn() })).rejects.toThrow('Logs expired')
    await expect(readVerifiedPrContext({ ...options, download: vi.fn().mockResolvedValue({ ...context, headSha: 'invalid' }) })).rejects.toThrow()
  })
})

it('checks authenticated ZIP digest before parsing it and never reselects the artifact by name', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new TextEncoder().encode('substituted archive').buffer })
  vi.stubGlobal('fetch', fetch)
  const request = vi.fn()
  await expect(downloadPrContext({ ...optionsFor(), request })).rejects.toThrow('digest does not match')
  expect(request).not.toHaveBeenCalled()
  expect(fetch).toHaveBeenCalledWith(`https://api.example.test/repos/${repository}/actions/artifacts/456/zip`, expect.anything())
})
