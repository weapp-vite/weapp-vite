import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 消费端按冻结源码重新核验 workspace 闭包，不重新打包。
import { execa } from 'execa'
import { packConsumerTarballs } from '../../packages/weapp-vite/scripts/consumerTarballs.mjs'

const digest = value => createHash('sha256').update(value).digest('hex')
const fileDigest = async filename => digest(await readFile(filename))
const consumerEntryPackages = ['weapp-vite', 'wevu', '@weapp-vite/react']

/** 消费者 Node 可以不同，源码、平台、架构及构建 Node 必须与冻结的打包身份一致。 */
export async function consumerIdentity(root, commit = process.env.BUILD_ARTIFACT_EXPECTED_COMMIT || process.env.GITHUB_SHA) {
  assert(/^[a-f\d]{40}$/u.test(commit ?? ''), 'Tarballs require an immutable commit')
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  return { commit, os: process.platform, arch: process.arch, builderNodeMajor: '24', packageManager: process.env.BUILD_ARTIFACT_PACKAGE_MANAGER || manifest.packageManager, lockfileHash: await fileDigest(path.join(root, 'pnpm-lock.yaml')) }
}

async function packedFiles(directory) {
  const manifest = JSON.parse(await readFile(path.join(directory, 'consumer-tarballs.json'), 'utf8'))
  assert.equal(manifest.schemaVersion, 1, 'Unsupported packed consumer manifest')
  const files = {}
  const physicalDirectory = await realpath(directory)
  for (const [name, entry] of Object.entries(manifest.packages)) {
    assert(path.posix.basename(entry.file) === entry.file && path.win32.basename(entry.file) === entry.file && entry.file.endsWith('.tgz'), 'Invalid packed filename')
    const filename = path.join(directory, entry.file)
    assert.equal(path.dirname(await realpath(filename)), physicalDirectory, 'Packed file escaped artifact')
    files[name] = { file: entry.file, version: entry.version, sha256: await fileDigest(filename) }
  }
  for (const name of consumerEntryPackages) {
    assert(files[name], `Missing consumer entry package: ${name}`)
  }
  return files
}

/** 从源码清单重新计算完整发布闭包，避免产物自身的清单遗漏运行时依赖。 */
export async function consumerClosure(root) {
  const listing = await execa('pnpm', ['--recursive', 'list', '--depth', '-1', '--json'], { cwd: root })
  const projects = new Map(JSON.parse(listing.stdout).map(project => [project.name, project.path]))
  const pending = [...consumerEntryPackages]
  const closure = {}
  while (pending.length) {
    const name = pending.pop()
    if (closure[name]) {
      continue
    }
    assert(projects.has(name), 'Missing consumer workspace dependency')
    const manifest = JSON.parse(await readFile(path.join(projects.get(name), 'package.json'), 'utf8'))
    assert.notEqual(manifest.private, true, 'Private consumer workspace dependency')
    closure[name] = manifest.version
    for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [dependency, specifier] of Object.entries(manifest[section] ?? {})) {
        if (specifier.startsWith('workspace:')) {
          pending.push(dependency)
        }
      }
    }
  }
  return closure
}

function verifyClosure(packages, expectedPackages) {
  assert.deepEqual(Object.fromEntries(Object.entries(packages).map(([name, entry]) => [name, entry.version])), expectedPackages, 'Consumer workspace closure mismatch')
}

export async function createConsumerArtifact(root, directory, { pack = true, identity, expectedPackages } = {}) {
  if (pack) {
    assert.equal(process.versions.node.split('.')[0], '24', 'Consumer artifacts must be built on Node 24')
    await packConsumerTarballs(root, directory, consumerEntryPackages)
  }
  const manifest = { schemaVersion: 1, identity: identity ?? await consumerIdentity(root), packages: await packedFiles(directory) }
  verifyClosure(manifest.packages, expectedPackages ?? await consumerClosure(root))
  await writeFile(path.join(directory, 'ci-provenance.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

export async function verifyConsumerArtifact(root, directory, identity, expectedPackages) {
  const manifest = JSON.parse(await readFile(path.join(directory, 'ci-provenance.json'), 'utf8'))
  assert.equal(manifest.schemaVersion, 1, 'Unsupported consumer artifact')
  assert.deepEqual(manifest.identity, identity ?? await consumerIdentity(root), 'Consumer artifact identity mismatch')
  assert.deepEqual(await packedFiles(directory), manifest.packages, 'Consumer artifact content mismatch')
  verifyClosure(manifest.packages, expectedPackages ?? await consumerClosure(root))
  return manifest
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, destination] = process.argv.slice(2)
  assert(destination, 'Expected pack|verify <artifact directory>')
  if (command === 'pack') {
    await createConsumerArtifact(process.cwd(), path.resolve(destination))
  }
  else if (command === 'verify') {
    await verifyConsumerArtifact(process.cwd(), path.resolve(destination))
  }
  else {
    throw new Error('Expected pack or verify')
  }
}
