import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 只读发现复用 gh，不接触令牌或调度工作流。
import { execa } from 'execa'
import { artifactFiles } from './artifacts.mjs'
import { readExecutionEvidence } from './evidence.mjs'
import { withCiRun } from './github.mjs'
import { validateCiConfiguration, validateCiContext, validateCiRun } from './identity.mjs'
import { frameworkInputPolicy, frameworkInputs } from './inputs.mjs'
import { discoverCoverage } from './prepareCoverage.mjs'
import { discoverTaskSuites } from './prepareTaskSuites.mjs'
import { generateCiTopology } from './topology.mjs'
import { immutableTree, relativeFile } from './tree.mjs'
import { readCiWorkload } from './workload.mjs'

async function discoverRuntime(artifacts, download, context, configuration) {
  const evidence = []
  const gaps = []
  for (const artifact of artifacts.filter(value => value.name.startsWith('ide-dom-headless-'))) {
    const suffix = artifact.name.slice('ide-dom-headless-'.length)
    try {
      const { directory } = await download(artifact.name)
      const files = await artifactFiles(directory)
      const suiteFiles = files.filter(file => /(?:^|\/)[^/]+-suite-report\/index\.json$/u.test(file))
      const acceptanceFiles = files.filter(file => /(?:^|\/)dom-acceptance\/.+\/index\.json$/u.test(file))
      assert(suiteFiles.length === 1 && acceptanceFiles.length > 0, 'Missing or duplicate strict suite/DOM reports')
      const suite = JSON.parse(await readFile(path.join(directory, suiteFiles[0]), 'utf8'))
      const acceptance = await Promise.all(acceptanceFiles.map(async file => JSON.parse(await readFile(path.join(directory, file), 'utf8'))))
      const { runtimeScope } = await import('../evidence.mjs')
      const descriptor = {
        id: `runtime-${suffix}`,
        kind: 'runtime',
        scope: runtimeScope(suite, acceptance),
        suite: { artifact: artifact.name, filePattern: '**/*-suite-report/index.json', expectedCount: 1 },
        acceptance: [{ artifact: artifact.name, filePattern: '**/dom-acceptance/**/index.json', expectedCount: acceptanceFiles.length }],
        toolchain: { artifact: `miniapp-${suffix}-weapp-build`, file: '.tmp/build-artifact-manifest.json' },
      }
      const observed = await readExecutionEvidence({ ...configuration, evidence: [descriptor] }, context, download, configuration)
      assert(observed.complete, observed.reason)
      evidence.push(descriptor)
    }
    catch (error) {
      gaps.push({ id: `runtime-${suffix}`, reason: error.message })
    }
  }
  if (!evidence.length) {
    gaps.push({ id: 'runtime', reason: 'No complete strict runtime checkpoints with actual matching full Node/pnpm/build toolchain identity' })
  }
  return { evidence, gaps }
}

/** discovery 只生成待审草稿，不把一次发现或预期列表当作正式性能样本。 */
export async function prepareCiBenchmark(repository, runId, options, execute = execa) {
  assert(options && ['os', 'node', 'provider', 'platform', 'runnerClass', 'cachePolicy'].every(key => typeof options.profile?.[key] === 'string' && options.profile[key]), 'prepare requires an explicit full benchmark resource policy')
  assert(['baseline', 'candidate'].includes(options.cohort?.variant) && typeof options.cohort.id === 'string' && options.cohort.id, 'prepare requires a cohort id and variant')
  const contractPath = relativeFile(options.contract ?? '.github/verification-benchmark.json')
  return withCiRun(repository, runId, execute, async ({ run, jobs, artifacts, allArtifacts, get, download, downloads }) => {
    const artifact = await download('pr-context')
    const raw = JSON.parse(await readFile(path.join(artifact.directory, 'context.json'), 'utf8'))
    const identity = {
      repository,
      prNumber: Number(raw.prNumber),
      runId: run.id,
      runAttempt: run.run_attempt,
      event: run.event,
      workflow: run.path,
      headSha: raw.headSha,
      baseSha: raw.baseSha,
      driverSha: raw.driverSha,
      checkoutSha: raw.checkoutSha,
      checkoutMode: raw.checkoutMode,
    }
    const configuration = { schemaVersion: 1, identity, cohort: options.cohort, contract: contractPath }
    validateCiConfiguration(configuration, repository, runId)
    validateCiRun(run, identity)
    const { context, sourceFingerprint } = await validateCiContext(artifact.directory, run, identity, get)
    const workload = await readCiWorkload(context, get)
    const tree = await immutableTree(context, get)
    const topology = await generateCiTopology(jobs, async file => (await tree.read(file)).bytes.toString('utf8'))
    Object.assign(configuration, { needs: topology.needs, outOfScope: topology.outOfScope })
    const inputs = await frameworkInputs(tree.entries, tree.read)
    const base = { ...configuration, profile: options.profile }
    const coverage = await discoverCoverage(artifacts, download, context, base)
    const runtime = await discoverRuntime(artifacts, download, context, base)
    const taskSuites = await discoverTaskSuites(artifacts, download, context, base)
    return {
      schemaVersion: 1,
      kind: 'ci-benchmark-preparation',
      formalSample: false,
      configuration,
      contract: { schemaVersion: 1, draft: true, workload, inputPolicy: frameworkInputPolicy, profile: options.profile, needs: topology.needs, outOfScope: topology.outOfScope, evidence: [...coverage.evidence, ...runtime.evidence, ...taskSuites.evidence] },
      receipt: { discoveryRun: identity, sourceFingerprint, treeSha: context.treeSha, workload, workflowSources: topology.sourceFiles, inputs: inputs.receipt, inputDigest: inputs.inputDigest, artifactInventory: allArtifacts, downloadedArtifacts: [...downloads.values()].map(value => value.artifact) },
      gaps: [...coverage.gaps, ...runtime.gaps, ...taskSuites.gaps, { id: 'review', reason: 'Audit every executed job against the expected logical scopes, review/commit a complete non-draft contract before formal runs; discovery is excluded from all three-round cohorts' }],
    }
  })
}
