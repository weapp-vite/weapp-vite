import assert from 'node:assert/strict'
// eslint-disable-next-line e18e/ban-dependencies -- 严格消费者保留发布包的 semver peer 范围语义。
import { intersects, satisfies, valid, validRange } from 'semver'
import { readPackedPackageJsonFromTarball } from '../../../scripts/print-rolldown-versions.mjs'

function publishedRange(specifier, owner) {
  assert(typeof specifier === 'string' && specifier.trim() && validRange(specifier), `Invalid published peer range: ${owner} -> ${specifier}`)
  return specifier
}

/** 从实际发布档案核验全包消费者的必需 peer，仅补入核心包声明的 Vite 宿主规格。 */
export function resolveConsumerPeers(candidates, suppliedPeers, directDependencies = {}) {
  const manifests = new Map(Object.entries(candidates).map(([name, archive]) => {
    assert(typeof archive === 'string' && archive.startsWith('file:') && archive.endsWith('.tgz'), `Expected candidate tarball: ${name}`)
    const manifest = readPackedPackageJsonFromTarball(archive.slice(5))
    assert.equal(manifest.name, name, `Candidate tarball name mismatch: ${name}`)
    assert(typeof manifest.version === 'string' && valid(manifest.version), `Invalid candidate version: ${name}`)
    return [name, manifest]
  }))
  // 已由直接依赖提供的候选不能被 devDependencies 中的 registry 规格覆盖。
  const peers = Object.fromEntries(Object.entries(suppliedPeers)
    .filter(([name]) => !manifests.has(name) && !Object.hasOwn(directDependencies, name)))
  const providers = { ...peers, ...directDependencies }
  const required = new Map()
  for (const [owner, manifest] of manifests) {
    for (const [name, range] of Object.entries(manifest.peerDependencies ?? {})) {
      if (manifest.peerDependenciesMeta?.[name]?.optional === true) {
        continue
      }
      const declarations = required.get(name) ?? []
      declarations.push({ owner, range: publishedRange(range, `${owner} peer ${name}`) })
      required.set(name, declarations)
    }
  }
  for (const [name, declarations] of required) {
    const candidate = manifests.get(name)
    let provider = candidate?.version ?? providers[name]
    if (provider === undefined && name === 'vite') {
      provider = manifests.get('weapp-vite')?.dependencies?.vite
      if (provider !== undefined) {
        peers[name] = provider
      }
    }
    for (const { owner, range } of declarations) {
      assert(provider !== undefined, `Missing explicit consumer peer: ${owner} requires ${name}@${range}`)
      publishedRange(provider, `consumer ${name}`)
      // 范围交集仅作预检；包管理器的真实 strict 安装仍负责最终解析和完整 peer 校验。
      assert(candidate ? satisfies(provider, range) : intersects(provider, range), `Consumer peer conflict: ${owner} requires ${name}@${range}, supplied ${provider}`)
    }
  }
  return peers
}
