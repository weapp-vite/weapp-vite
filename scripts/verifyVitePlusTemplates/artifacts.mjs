import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { applyDependencyTarballs, resolveDependencyTarballs } from '../createWeappViteSmoke/dependencyTarballs.mjs'
import { readPackedPackageJsonFromTarball } from '../print-rolldown-versions.mjs'
import { requiredCandidates } from './contracts.mjs'

/** 在启动安装前校验真实 tarball 名称与摘要，防止文件名伪装成候选包。 */
export async function readCandidates(value) {
  const artifacts = await resolveDependencyTarballs(value)
  assert(requiredCandidates.every(name => artifacts.some(item => item.name === name)), `Dependency tarballs must include ${requiredCandidates.join(', ')}`)
  return Promise.all(artifacts.map(async (artifact) => {
    const manifest = readPackedPackageJsonFromTarball(artifact.tarball)
    assert.equal(manifest.name, artifact.name, `Candidate tarball package name mismatch: ${artifact.name}`)
    assert(typeof manifest.version === 'string' && manifest.version, `Candidate tarball has no version: ${artifact.name}`)
    const bytes = await fs.readFile(artifact.tarball)
    return {
      ...artifact,
      version: manifest.version,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
    }
  }))
}

/** 候选覆盖只用于安装；恢复原始生成文件后才进行格式验收。 */
export async function applyCandidateOverlay(root, manager, artifacts) {
  const filename = path.join(root, manager === 'pnpm' ? 'pnpm-workspace.yaml' : 'package.json')
  const original = await fs.readFile(filename)
  if (manager === 'pnpm') {
    await applyDependencyTarballs(root, artifacts)
  }
  else {
    assert.equal(manager, 'npm')
    const manifest = JSON.parse(original.toString())
    manifest.overrides ??= {}
    for (const { name, tarball } of artifacts) {
      const specifier = `file:${tarball.replaceAll('\\', '/')}`
      let direct = false
      for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
        if (Object.hasOwn(manifest[field] ?? {}, name)) {
          manifest[field][name] = specifier
          direct = true
        }
      }
      manifest.overrides[name] = direct ? `$${name}` : specifier
    }
    await fs.writeFile(filename, `${JSON.stringify(manifest, null, 2)}\n`)
  }
  return () => fs.writeFile(filename, original)
}

/** 不跟随目录链接；验证所有链接归属，记录实际安装包并核对 lockfile tarball 完整性。 */
export async function inspectInstallation(root, artifacts, manager) {
  const resolvedRoot = await fs.realpath(root)
  const installed = new Map()
  let links = 0
  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isSymbolicLink()) {
        const relative = path.relative(resolvedRoot, await fs.realpath(file))
        assert(relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), 'Installed link escapes isolated consumer')
        links++
      }
      else if (entry.isDirectory()) {
        await visit(file)
      }
      else if (entry.name === 'package.json' && /(?:^|\/)node_modules\/(?:@[^/]+\/)?[^/]+\/package\.json$/.test(file.replaceAll('\\', '/'))) {
        const manifest = JSON.parse(await fs.readFile(file, 'utf8'))
        if (artifacts.some(item => item.name === manifest.name)) {
          const versions = installed.get(manifest.name) ?? new Set()
          versions.add(manifest.version)
          installed.set(manifest.name, versions)
        }
      }
    }
  }
  await visit(path.join(root, 'node_modules'))
  const lock = await fs.readFile(path.join(root, manager === 'pnpm' ? 'pnpm-lock.yaml' : 'package-lock.json'), 'utf8')
  for (const name of requiredCandidates) {
    assert(installed.has(name), `Required candidate was not installed: ${name}`)
  }
  const candidates = artifacts.map(({ name, version, integrity }) => {
    const versions = [...(installed.get(name) ?? [])]
    if (versions.length) {
      assert.deepEqual(versions, [version], `Installed candidate version mismatch: ${name}`)
      assert(lock.includes(integrity), `Lockfile did not use candidate tarball integrity: ${name}`)
    }
    return { name, version, installed: versions.length > 0 }
  })
  return { links, candidates }
}
