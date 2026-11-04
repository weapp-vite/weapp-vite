import type { Fetcher, PreviewManifest } from './contract.ts'
import assert from 'node:assert/strict'
import { appendFile, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { setTimeout } from 'node:timers/promises'
import { archiveIntegrity, confirmLatestTag, confirmRegistry, PACKAGE_ENDPOINT, PACKAGE_NAME, previewVersion, readPreviewManifest, registryJson, RegistryPropagationPending, sourceSha } from './contract.ts'

interface ConfirmOptions { manifest: string, env?: NodeJS.ProcessEnv, fetcher?: Fetcher, wait?: (milliseconds: number) => Promise<unknown> }

/** 只重读延迟传播的 metadata；不重发发布，完整性与非 bootstrap latest 漂移立即失败。 */
async function waitForRegistry(manifest: PreviewManifest, fetcher: Fetcher, wait: NonNullable<ConfirmOptions['wait']>) {
  const deadline = performance.now() + 120_000
  const signal = AbortSignal.timeout(120_000)
  for (let attempt = 1; attempt <= 12; attempt++) {
    if (performance.now() >= deadline) {
      throw new Error('Registry confirmation exceeded its 120-second deadline; inspect the existing publish before any retry')
    }
    try {
      const version = await registryJson(`${PACKAGE_ENDPOINT}/${manifest.version}`, fetcher, true, signal)
      const metadata = await registryJson(PACKAGE_ENDPOINT, fetcher, true, signal)
      signal.throwIfAborted()
      if (metadata) {
        confirmLatestTag(manifest, metadata)
      }
      if (!version || !metadata) {
        throw new RegistryPropagationPending('Published version metadata is not visible yet')
      }
      return { provenance: confirmRegistry(manifest, version, metadata), latestState: confirmLatestTag(manifest, metadata), attempts: attempt }
    }
    catch (error) {
      if (!(error instanceof RegistryPropagationPending)) {
        throw error
      }
      if (attempt === 12) {
        throw new Error('Registry confirmation did not propagate after 12 attempts; inspect the existing publish before any retry', { cause: error })
      }
      await wait(Math.min(10_000, Math.max(0, deadline - performance.now())))
    }
  }
  throw new Error('Registry confirmation exhausted')
}

/** 发布后精确核对官方版本与完整性，明确记录未变或 bootstrap 提升的 latest。 */
export async function confirmPreview({ manifest: filename, env = process.env, fetcher = fetch, wait = setTimeout }: ConfirmOptions) {
  const manifest = readPreviewManifest(JSON.parse(await readFile(filename, 'utf8')) as unknown)
  assert.equal(manifest.sourceSha, sourceSha(env.GITHUB_SHA), 'Manifest source differs from the guarded CI revision')
  assert.equal(manifest.version, previewVersion(env.PREVIEW_VERSION), 'Manifest differs from PREVIEW_VERSION')
  assert.equal(archiveIntegrity(await readFile(manifest.tarball)), manifest.integrity, 'Local archive changed after prepare')
  const { provenance, latestState, attempts } = await waitForRegistry(manifest, fetcher, wait)
  const confirmation = { name: PACKAGE_NAME, version: manifest.version, tag: manifest.tag, sourceSha: manifest.sourceSha, integrity: manifest.integrity, ...latestState, provenance, provenanceVerification: 'metadata-only', registryConfirmationAttempts: attempts, verifiedAt: new Date().toISOString() }
  await writeFile(path.join(path.dirname(filename), 'confirmed.json'), `${JSON.stringify(confirmation, null, 2)}\n`, { flag: 'wx' })
  const summary = [
    '## WXML alpha 预览发布',
    '',
    `- 包版本：\`${PACKAGE_NAME}@${manifest.version}\`；tag：\`alpha\`。`,
    `- 源提交：\`${manifest.sourceSha}\`。`,
    `- 安装：\`npm install ${PACKAGE_NAME}@${manifest.version}\`。`,
    `- 完整性：\`${manifest.integrity}\`，与本次 tarball 一致。`,
    latestState.bootstrapLatestPromoted
      ? `- latest：npm bootstrap 首次真实发布的服务端默认标签从 \`${latestState.latestBefore}\` 改为 \`${latestState.latest}\`；latestUnchanged=false，bootstrapLatestPromoted=true。`
      : `- latest：保持${latestState.latest === null ? '不存在' : `为 \`${latestState.latest}\``}。`,
    `- OIDC provenance：CI 通过 npm trusted publishing 请求；官方 registry 已记录 [SLSA provenance](${provenance.url})。`,
    '- 确认范围：registry provenance 元数据存在；本 helper 不进行独立的 Sigstore 签名验证。',
    '',
  ].join('\n')
  if (env.GITHUB_STEP_SUMMARY) {
    await appendFile(env.GITHUB_STEP_SUMMARY, summary)
  }
  return { confirmation, summary }
}
