import { Buffer } from 'node:buffer'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveConsumerPeers } from '../scripts/consumerPeers.mjs'

interface Manifest {
  name: string
  version: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, { optional: boolean }>
}

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

/** 生成包含真实 package.json 条目的压缩 tar，验证不会改读工作区清单。 */
async function archives(manifests: Manifest[]) {
  const root = await mkdtemp(path.join(tmpdir(), 'consumer-peers-'))
  directories.push(root)
  const candidates: Record<string, string> = {}
  for (const manifest of manifests) {
    const content = Buffer.from(JSON.stringify(manifest))
    const header = Buffer.alloc(512)
    header.write('package/package.json')
    header.write('0000644\0', 100)
    header.write(`${content.length.toString(8).padStart(11, '0')}\0`, 124)
    header.fill(32, 148, 156)
    header.write('0', 156)
    header.write('ustar\0', 257)
    header.write('00', 263)
    const checksum = header.reduce((sum, byte) => sum + byte, 0)
    header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148)
    const file = path.join(root, `${manifest.name.replaceAll('/', '-')}.tgz`)
    await writeFile(file, gzipSync(Buffer.concat([header, content, Buffer.alloc((512 - content.length % 512) % 512 + 1024)])))
    candidates[manifest.name] = `file:${file.replaceAll('\\', '/')}`
  }
  return candidates
}

function core(vite: string): Manifest {
  return { name: 'weapp-vite', version: '1.0.0', dependencies: { vite } }
}
function plugin(vite: string, optional = false): Manifest {
  return {
    name: 'vite-plugin-performance',
    version: '1.0.0',
    peerDependencies: { vite },
    ...(optional ? { peerDependenciesMeta: { vite: { optional } } } : {}),
  }
}

describe('strict full-package consumer peer supply', () => {
  it.each(['8.3.2', '8.4.0', '^8.4.0'])('uses packed core Vite %s for the plugin peer', async (vite) => {
    const candidates = await archives([core(vite), plugin('^8')])
    const supplied = { tailwindcss: '^4' }
    expect(resolveConsumerPeers(candidates, supplied)).toEqual({ ...supplied, vite })
    expect(supplied).toEqual({ tailwindcss: '^4' })
  })

  it('retains an explicit compatible provider instead of replacing it with core Vite', async () => {
    expect(resolveConsumerPeers(await archives([core('8.3.2'), plugin('^8')]), { vite: '8.4.0' }))
      .toEqual({ vite: '8.4.0' })
  })

  it('rejects a conflicting required peer with its declaring package and supplied range', async () => {
    const candidates = await archives([core('8.4.0'), plugin('^8'), { name: 'another-plugin', version: '1.0.0', peerDependencies: { vite: '^9' } }])
    expect(() => resolveConsumerPeers(candidates, {}))
      .toThrow('another-plugin requires vite@^9, supplied 8.4.0')
  })

  it('does not supply optional-only peers but still satisfies another required declaration', async () => {
    expect(resolveConsumerPeers(await archives([core('8.4.0'), plugin('^8', true)]), {})).toEqual({})
    const candidates = await archives([core('8.4.0'), plugin('^8', true), { name: 'required-plugin', version: '1.0.0', peerDependencies: { vite: '^8' } }])
    expect(resolveConsumerPeers(candidates, {})).toEqual({ vite: '8.4.0' })
  })

  it('keeps candidate peer providers as tarballs and validates their actual published version', async () => {
    const manifests: Manifest[] = [{ name: 'adapter', version: '1.0.0', peerDependencies: { runtime: '^2' } }, { name: 'runtime', version: '2.1.0' }]
    const candidates = await archives(manifests)
    expect(resolveConsumerPeers(candidates, { runtime: '3.0.0' })).toEqual({})
    expect(candidates.runtime).toMatch(/^file:.*\.tgz$/)
    const conflicting = await archives([manifests[0]!, { name: 'runtime', version: '3.0.0' }])
    expect(() => resolveConsumerPeers(conflicting, {})).toThrow('adapter requires runtime@^2, supplied 3.0.0')
  })

  it('accepts peers already supplied by explicit direct dependencies', async () => {
    const candidates = await archives([{ name: 'adapter', version: '1.0.0', peerDependencies: { typescript: '^6' } }])
    expect(resolveConsumerPeers(candidates, { typescript: '^5' }, { typescript: '6.0.3' })).toEqual({})
  })

  it('fails on an unprovided external required peer without adding arbitrary core dependencies', async () => {
    const candidates = await archives([{ ...core('8.4.0'), dependencies: { vite: '8.4.0', other: '1.0.0' } }, { name: 'adapter', version: '1.0.0', peerDependencies: { other: '^1' } }])
    expect(() => resolveConsumerPeers(candidates, {})).toThrow('Missing explicit consumer peer: adapter requires other@^1')
  })

  it.each(['catalog:', 'workspace:*', 'file:../vite', 'latest', ''])('rejects an unpublished Vite provider: %s', async (vite) => {
    const candidates = await archives([core(vite), plugin('^8')])
    expect(() => resolveConsumerPeers(candidates, {})).toThrow('Invalid published peer range: consumer vite')
  })

  it('rejects a required peer range that was not resolved during packing', async () => {
    const candidates = await archives([core('8.4.0'), plugin('catalog:')])
    expect(() => resolveConsumerPeers(candidates, {})).toThrow('vite-plugin-performance peer vite -> catalog:')
  })

  it('rejects a missing packed core Vite declaration instead of using the workspace engine', async () => {
    const candidates = await archives([{ name: 'weapp-vite', version: '1.0.0' }, plugin('^8')])
    expect(() => resolveConsumerPeers(candidates, {})).toThrow('Missing explicit consumer peer: vite-plugin-performance requires vite@^8')
  })

  it('rejects a tarball assigned to another candidate name', async () => {
    const candidates = await archives([core('8.4.0')])
    expect(() => resolveConsumerPeers({ wrong: candidates['weapp-vite']! }, {})).toThrow('Candidate tarball name mismatch: wrong')
  })
})
