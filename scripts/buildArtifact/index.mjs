import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const outputRoots = ['packages', 'packages-runtime', 'packages-private', '@weapp-core', 'benchmarks', 'mpcore/packages']
const outputPattern = /^(?:packages|packages-runtime|packages-private|@weapp-core|benchmarks|mpcore\/packages)\/[^/]+\/(?:dist|bin)\/.+$/u
const digestPattern = /^[a-f\d]{64}$/u

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function optionalFile(root, relative) {
  const absolute = path.join(root, relative)
  return fs.existsSync(absolute) ? fs.readFileSync(absolute) : null
}

function packageManager(root) {
  const bytes = optionalFile(root, 'package.json')
  return bytes ? JSON.parse(bytes.toString()).packageManager ?? null : null
}

function lockfileHash(root) {
  const bytes = optionalFile(root, 'pnpm-lock.yaml')
  return bytes ? digest(bytes) : null
}

function actualPackageManager(env) {
  const value = env.BUILD_ARTIFACT_PACKAGE_MANAGER ?? null
  if (value !== null && !/^pnpm@\d+\.\d+\.\d+(?:-[\w.-]+)?$/u.test(value)) {
    throw new Error('Invalid actual build package manager identity')
  }
  return value
}

function scopedPackage(file) {
  return file.slice(0, file.search(/\/(?:dist|bin)\//u))
}

function safeOutput(root, relative) {
  if (typeof relative !== 'string' || relative.includes('\\') || relative.includes('\0')
    || relative.split('/').some(part => part === '.' || part === '..') || !outputPattern.test(relative)) {
    throw new Error(`Invalid build artifact output: ${String(relative)}`)
  }
  const absolute = path.resolve(root, relative)
  const actual = fs.realpathSync(absolute)
  const within = path.relative(fs.realpathSync(root), actual)
  if (within.startsWith(`..${path.sep}`) || within === '..' || path.isAbsolute(within) || !fs.statSync(actual).isFile()) {
    throw new Error(`Build artifact output escapes its workspace: ${relative}`)
  }
  return absolute
}

function collectOutputs(root) {
  const files = []
  function visit(directory, relative) {
    if (!fs.existsSync(directory)) {
      return
    }
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const name = `${relative}/${entry.name}`
      if (entry.isDirectory()) {
        visit(path.join(directory, entry.name), name)
      }
      else if (entry.isFile() || entry.isSymbolicLink()) {
        files.push(name)
      }
    }
  }
  for (const outputRoot of outputRoots) {
    const directory = path.join(root, outputRoot)
    if (!fs.existsSync(directory)) {
      continue
    }
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue
      }
      for (const output of ['dist', 'bin']) {
        const relative = `${outputRoot}/${entry.name}/${output}`
        visit(path.join(root, relative), relative)
      }
    }
  }
  return files.sort()
}

/** 只收集实际上传的包级产物，并绑定冻结提交、工具链与每个文件的内容。 */
export function createBuildArtifactManifest(root, env = process.env) {
  const files = collectOutputs(root)
  if (files.length === 0) {
    throw new Error('No workspace build outputs found for artifact manifest')
  }
  return {
    schemaVersion: 2,
    commit: env.BUILD_ARTIFACT_EXPECTED_COMMIT ?? env.GITHUB_SHA ?? '',
    nodeMajor: process.versions.node.split('.')[0],
    os: env.RUNNER_OS ?? process.platform,
    arch: process.arch,
    toolchain: { nodeVersion: process.version, packageManager: packageManager(root), actualPackageManager: actualPackageManager(env) },
    lockfileHash: lockfileHash(root),
    scope: [...new Set(files.map(scopedPackage))].sort(),
    files,
    checksums: Object.fromEntries(files.map(file => [file, digest(fs.readFileSync(safeOutput(root, file)))])),
  }
}

/** 恢复后先核对身份和内容；存在文件并不代表它属于本轮构建。 */
export function verifyBuildArtifactManifest(root, manifest, env = process.env) {
  if (manifest?.schemaVersion !== 2) {
    throw new Error('Unsupported build artifact manifest schema')
  }
  const expected = {
    commit: env.BUILD_ARTIFACT_EXPECTED_COMMIT ?? env.GITHUB_SHA ?? '',
    nodeMajor: env.BUILD_ARTIFACT_EXPECTED_NODE_MAJOR ?? process.versions.node.split('.')[0],
    os: env.BUILD_ARTIFACT_EXPECTED_OS ?? env.RUNNER_OS ?? process.platform,
    arch: env.BUILD_ARTIFACT_EXPECTED_ARCH ?? process.arch,
    lockfileHash: lockfileHash(root),
  }
  for (const [key, value] of Object.entries(expected)) {
    if (manifest[key] !== value) {
      throw new Error(`Build artifact manifest mismatch for ${key}`)
    }
  }
  if (!manifest.toolchain || manifest.toolchain.packageManager !== packageManager(root)
    || manifest.toolchain.actualPackageManager !== actualPackageManager(env)
    || !/^v\d+\.\d+\.\d+(?:-[\w.-]+)?$/u.test(manifest.toolchain.nodeVersion)
    || manifest.toolchain.nodeVersion.slice(1).split('.')[0] !== manifest.nodeMajor) {
    throw new Error('Build artifact toolchain mismatch')
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0 || new Set(manifest.files).size !== manifest.files.length) {
    throw new Error('Build artifact outputs are empty or duplicated')
  }
  if (!manifest.checksums || Array.isArray(manifest.checksums)
    || Object.keys(manifest.checksums).length !== manifest.files.length) {
    throw new Error('Build artifact checksum inventory mismatch')
  }
  for (const file of manifest.files) {
    const absolute = safeOutput(root, file)
    if (!digestPattern.test(manifest.checksums[file]) || digest(fs.readFileSync(absolute)) !== manifest.checksums[file]) {
      throw new Error(`Build artifact checksum mismatch: ${file}`)
    }
  }
  const scope = [...new Set(manifest.files.map(scopedPackage))].sort()
  if (JSON.stringify(manifest.scope) !== JSON.stringify(scope)) {
    throw new Error('Build artifact scope mismatch')
  }
  const required = (env.BUILD_ARTIFACT_EXPECTED_SCOPE ?? '').split(',').map(value => value.trim()).filter(Boolean)
  if (required.some(name => !scope.includes(name))) {
    throw new Error('Build artifact does not cover the required packages')
  }
  return manifest
}
