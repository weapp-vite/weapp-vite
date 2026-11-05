import type { AcceptanceArtifact, AcceptanceOptions, AcceptanceReport, ApiVariant } from './harness'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { acceptanceArtifact, acceptancePaths, repositoryRoot, sha256 } from './harness'

type Runtime = AcceptanceReport['runtime']['kind']
type Runner = (options: AcceptanceOptions) => Promise<AcceptanceReport>

export interface FrozenRunIdentity {
  manifest: { sha256: string, id: string, contentSha256: string }
  variants: Partial<Record<ApiVariant, { artifact: AcceptanceArtifact, presetsArtifact: AcceptanceArtifact }>>
}

export interface FrozenRunResult {
  identity: FrozenRunIdentity
  identityUnchanged: boolean
  variants: Partial<Record<ApiVariant, Partial<Record<Runtime, boolean>>>>
  errors: string[]
}

/** 四段运行开始前固定同一清单和全部构建模块，独立运行不能另选自己的冻结基线。 */
export async function captureFrozenRun(options: readonly AcceptanceOptions[]): Promise<FrozenRunIdentity> {
  assert.ok(options.length > 0, 'Frozen acceptance requires at least one API variant')
  const selected = options.map(acceptancePaths)
  const corpus = selected[0]!.corpusDirectory
  assert.ok(selected.every(value => value.corpusDirectory === corpus), 'Frozen acceptance variants must share one corpus directory')
  const bytes = await readFile(path.join(corpus, 'manifest.json'))
  const manifest: unknown = JSON.parse(bytes.toString('utf8'))
  assert.ok(manifest && typeof manifest === 'object' && 'id' in manifest && typeof manifest.id === 'string' && 'contentSha256' in manifest && typeof manifest.contentSha256 === 'string', 'Invalid frozen acceptance manifest')
  const result: FrozenRunIdentity = { manifest: { sha256: sha256(bytes), id: manifest.id, contentSha256: manifest.contentSha256 }, variants: {} }
  for (const value of selected) {
    assert.ok(!result.variants[value.apiVariant], 'Frozen acceptance cannot repeat an API variant')
    result.variants[value.apiVariant] = { artifact: await acceptanceArtifact(value.builtEntry), presetsArtifact: await acceptanceArtifact(value.presetsEntry) }
  }
  return result
}

export async function assertFrozenRunIdentity(expected: FrozenRunIdentity, options: readonly AcceptanceOptions[]): Promise<void> {
  assert.deepEqual(await captureFrozenRun(options), expected, 'Common frozen manifest or build identity changed between acceptance stages')
}

/** 每段报告须证明自己执行的正是整轮共同冻结的输入，不能只汇总各段布尔值。 */
export function assertReportFrozenIdentity(expected: FrozenRunIdentity, report: AcceptanceReport): void {
  const variant = expected.variants[report.apiVariant]
  assert.ok(variant, 'Acceptance report has an API variant outside the frozen run')
  assert.ok(report.frozen, 'Acceptance report is missing its frozen corpus identity')
  assert.equal(report.frozen.manifestSha256, expected.manifest.sha256, 'Acceptance report manifest differs from the common frozen run')
  assert.equal(report.frozen.id, expected.manifest.id, 'Acceptance report corpus id differs from the common frozen run')
  assert.equal(report.frozen.contentSha256, expected.manifest.contentSha256, 'Acceptance report corpus contents differ from the common frozen run')
  assert.deepEqual(report.artifact, variant.artifact, 'Acceptance report build differs from the common frozen run')
  assert.deepEqual(report.presetsArtifact, variant.presetsArtifact, 'Acceptance report preset build differs from the common frozen run')
}

/** 顺序执行并在阶段前后复核共同身份；身份漂移立即停止，仍写出拒绝验收的聚合证据。 */
export async function runFrozenAcceptance(options: readonly AcceptanceOptions[], identity: FrozenRunIdentity, runners: Record<Runtime, Runner>): Promise<FrozenRunResult> {
  const result: FrozenRunResult = { identity, identityUnchanged: false, variants: {}, errors: [] }
  try {
    await assertFrozenRunIdentity(identity, options)
    for (const option of options) {
      const selected = acceptancePaths(option)
      const variant: Partial<Record<Runtime, boolean>> = {}
      result.variants[selected.apiVariant] = variant
      for (const runtime of ['node', 'chromium'] as const) {
        await assertFrozenRunIdentity(identity, options)
        const report = await runners[runtime](option)
        variant[runtime] = report.accepted
        assert.equal(report.apiVariant, selected.apiVariant, 'Acceptance runner returned another API variant')
        assert.equal(report.runtime.kind, runtime, 'Acceptance runner returned another runtime')
        assertReportFrozenIdentity(identity, report)
        await assertFrozenRunIdentity(identity, options)
      }
    }
    await assertFrozenRunIdentity(identity, options)
    result.identityUnchanged = true
  }
  catch (error) {
    result.errors.push((error instanceof Error ? error.message : String(error)).replaceAll(repositoryRoot, '<repository>/'))
  }
  return result
}
