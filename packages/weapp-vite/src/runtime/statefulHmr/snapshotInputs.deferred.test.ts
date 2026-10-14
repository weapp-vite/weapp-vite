import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { beforeEach, expect, it, vi } from 'vitest'
import { captureSnapshotInputs, coversSnapshotInputs, validateSnapshotInputs } from './snapshotInputs'

const filesystem = vi.hoisted(() => ({
  lstat: vi.fn(),
  readdir: vi.fn(),
  readFile: vi.fn(),
  realpath: vi.fn(),
}))

vi.mock('node:fs/promises', () => filesystem)

const root = path.join(tmpdir(), `snapshot-input-deferred-${randomUUID()}`)
const source = path.join(root, 'index.js')
const missing = (file: string) => Object.assign(new Error(`Missing input: ${file}`), { code: 'ENOENT' })
function stat(directory: boolean, symbolicLink = false) {
  return {
    isDirectory: () => directory,
    isSymbolicLink: () => symbolicLink,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  filesystem.realpath.mockImplementation(async file => file)
  filesystem.lstat.mockImplementation(async (file) => {
    if (file === root) {
      return stat(true)
    }
    if (file === source) {
      return stat(false)
    }
    throw missing(file)
  })
  filesystem.readdir.mockResolvedValue(['index.js'])
  filesystem.readFile.mockResolvedValue(Buffer.from('before'))
})

it('uses a captured directory listing instead of probing absent native sidecars', async () => {
  const sidecars = ['index.jsonc', 'index.wxss', 'optional/index.wxml'].map(file => path.join(root, file))
  filesystem.realpath.mockImplementation(async (file) => {
    if (file === root || file === source || !file.startsWith(`${root}/`)) {
      return file
    }
    throw missing(file)
  })
  const scope = { roots: [root], files: [source, ...sidecars], excluded: [] }
  const inputs = await captureSnapshotInputs(scope)

  for (const sidecar of sidecars) {
    expect(filesystem.realpath).not.toHaveBeenCalledWith(sidecar)
    expect(filesystem.lstat).not.toHaveBeenCalledWith(sidecar)
  }
  expect(filesystem.readFile).toHaveBeenCalledOnce()
  expect(coversSnapshotInputs(inputs, sidecars)).toBe(true)
  expect(await validateSnapshotInputs(inputs)).toBe(true)

  filesystem.readdir.mockResolvedValue(['index.js', 'index.jsonc'])
  filesystem.realpath.mockImplementation(async file => file)
  filesystem.lstat.mockImplementation(async file => stat(file === root))
  expect(await validateSnapshotInputs(inputs)).toBe(false)
  expect(filesystem.readFile).toHaveBeenCalledWith(sidecars[0])
})

it('reads explicit inputs omitted by a traversal skip instead of treating them as absent', async () => {
  const dependencyRoot = path.join(root, 'node_modules')
  const dependency = path.join(dependencyRoot, 'dependency.js')
  const absentDependency = path.join(dependencyRoot, 'absent.js')
  const lease = path.join(root, 'project.private.config.json')
  filesystem.readdir.mockResolvedValue(['index.js', 'node_modules', 'project.private.config.json'])
  filesystem.lstat.mockImplementation(async (file) => {
    if (file === absentDependency) {
      throw missing(file)
    }
    return stat(file === root || file === dependencyRoot)
  })
  const scope = { roots: [root], files: [dependency, absentDependency, lease], excluded: [], skipPaths: [dependencyRoot, lease] }
  const inputs = await captureSnapshotInputs(scope)

  expect(filesystem.readFile).toHaveBeenCalledWith(dependency)
  expect(filesystem.readFile).toHaveBeenCalledWith(lease)
  expect(filesystem.lstat).toHaveBeenCalledWith(absentDependency)
  expect(inputs.versions.get(absentDependency)).toBe('missing')
  expect(coversSnapshotInputs(inputs, [path.join(dependencyRoot, 'undeclared.js')])).toBe(false)
  filesystem.readFile.mockResolvedValue(Buffer.from('after'))
  expect(await validateSnapshotInputs(inputs)).toBe(false)
})

it('uses the physical root listing for aliased absent sidecars and still rejects a retargeted root', async () => {
  const alias = path.join(path.dirname(root), `${path.basename(root)}-alias`)
  const replacement = path.join(path.dirname(root), `${path.basename(root)}-replacement`)
  const sidecar = path.join(root, 'index.jsonc')
  let target = root
  filesystem.realpath.mockImplementation(async (file) => {
    if (file === alias) {
      return target
    }
    if (file.startsWith(`${alias}/`)) {
      return path.join(target, path.relative(alias, file))
    }
    if (file === sidecar) {
      throw missing(file)
    }
    return file
  })
  filesystem.lstat.mockImplementation(async file => stat(file === root || file === replacement, file === alias))
  const inputs = await captureSnapshotInputs({ roots: [alias], files: [sidecar], excluded: [] })

  expect(filesystem.realpath).not.toHaveBeenCalledWith(sidecar)
  expect(filesystem.lstat).not.toHaveBeenCalledWith(sidecar)
  expect(coversSnapshotInputs(inputs, [sidecar])).toBe(true)
  expect(filesystem.readFile).toHaveBeenCalledOnce()
  target = replacement
  expect(await validateSnapshotInputs(inputs)).toBe(false)
})

it('uses an absent root as a content proof and detects its later creation', async () => {
  const absentRoot = path.join(root, 'absent')
  const sidecar = path.join(absentRoot, 'index.jsonc')
  let created = false
  filesystem.realpath.mockImplementation(async (file) => {
    if (!created && (file === absentRoot || file.startsWith(`${absentRoot}/`))) {
      throw missing(file)
    }
    return file
  })
  filesystem.lstat.mockImplementation(async (file) => {
    if (!created && file === absentRoot) {
      throw missing(file)
    }
    return stat(file === absentRoot)
  })
  const inputs = await captureSnapshotInputs({ roots: [absentRoot], files: [sidecar], excluded: [] })

  expect(inputs.versions.get(absentRoot)).toBe('missing')
  expect(filesystem.realpath).not.toHaveBeenCalledWith(sidecar)
  expect(filesystem.lstat).not.toHaveBeenCalledWith(sidecar)
  expect(coversSnapshotInputs(inputs, [sidecar])).toBe(true)
  created = true
  filesystem.readdir.mockResolvedValue(['index.jsonc'])
  expect(await validateSnapshotInputs(inputs)).toBe(false)
})

it('does not mistake a file root for a directory proof', async () => {
  const child = path.join(source, 'index.jsonc')
  const failure = Object.assign(new Error('Input parent is a file'), { code: 'ENOTDIR' })
  filesystem.realpath.mockImplementation(async (file) => {
    if (file === child) {
      throw failure
    }
    return file
  })
  await expect(captureSnapshotInputs({ roots: [source], files: [child], excluded: [] })).rejects.toBe(failure)
  expect(filesystem.realpath).toHaveBeenCalledWith(child)
})

it('never probes excluded roots or descendants through their logical or physical paths', async () => {
  const outputRoot = path.join(root, 'dist')
  const physicalOutput = path.join(path.dirname(root), `${path.basename(root)}-generated`)
  const excludedRoots = [outputRoot, path.join(outputRoot, 'ignored'), physicalOutput, path.join(physicalOutput, 'ignored')]
  const outputFiles = [path.join(outputRoot, 'bundle.js'), path.join(physicalOutput, 'bundle.js')]
  const failure = Object.assign(new Error('Excluded output cannot be read'), { code: 'EACCES' })
  filesystem.realpath.mockImplementation(async (file) => {
    if (file === outputRoot) {
      return physicalOutput
    }
    if (file === physicalOutput) {
      return file
    }
    if (excludedRoots.includes(file) || outputFiles.includes(file)) {
      throw failure
    }
    return file
  })
  filesystem.readdir.mockResolvedValue(['index.js', 'dist'])
  const scope = { roots: [root, ...excludedRoots], files: [source, ...outputFiles], excluded: [outputRoot] }
  const inputs = await captureSnapshotInputs(scope)

  // excluded 自身只为建立物理别名读取一次；任何 excluded root 调度都不增加探测。
  expect(filesystem.realpath.mock.calls.filter(([file]) => file === outputRoot)).toHaveLength(1)
  for (const file of [...excludedRoots.slice(1), ...outputFiles]) {
    expect(filesystem.realpath).not.toHaveBeenCalledWith(file)
  }
  for (const file of [...excludedRoots, ...outputFiles]) {
    expect(filesystem.lstat).not.toHaveBeenCalledWith(file)
    expect(filesystem.readdir).not.toHaveBeenCalledWith(file)
    expect(filesystem.readFile).not.toHaveBeenCalledWith(file)
    expect(inputs.versions.has(file)).toBe(false)
  }
  expect(filesystem.readFile).toHaveBeenCalledOnce()
  expect(coversSnapshotInputs(inputs, outputFiles)).toBe(true)
  expect(await validateSnapshotInputs(inputs)).toBe(true)
  // validation 会重新解析展开后的两个排除别名，仍不读取任何排除内容。
  expect(filesystem.realpath.mock.calls.filter(([file]) => file === outputRoot)).toHaveLength(2)
  expect(filesystem.realpath.mock.calls.filter(([file]) => file === physicalOutput)).toHaveLength(1)
  for (const file of [...excludedRoots.filter(file => file !== outputRoot && file !== physicalOutput), ...outputFiles]) {
    expect(filesystem.realpath).not.toHaveBeenCalledWith(file)
  }
  for (const file of [...excludedRoots, ...outputFiles]) {
    expect(filesystem.lstat).not.toHaveBeenCalledWith(file)
    expect(filesystem.readdir).not.toHaveBeenCalledWith(file)
    expect(filesystem.readFile).not.toHaveBeenCalledWith(file)
  }
})

it('starts outside dependencies while the root listing is still pending', async () => {
  const external = path.join(path.dirname(root), `${path.basename(root)}-external.js`)
  const readingExternal = Promise.withResolvers<void>()
  const releaseDirectory = Promise.withResolvers<void>()
  filesystem.lstat.mockImplementation(async file => stat(file === root))
  filesystem.readdir.mockImplementation(async () => {
    await releaseDirectory.promise
    return ['index.js']
  })
  filesystem.readFile.mockImplementation(async (file) => {
    if (file === external) {
      readingExternal.resolve()
    }
    return Buffer.from('before')
  })
  const capture = captureSnapshotInputs({ roots: [root], files: [source, external], excluded: [] })
  await readingExternal.promise
  expect(filesystem.readFile).not.toHaveBeenCalledWith(source)
  releaseDirectory.resolve()
  const inputs = await capture

  expect(filesystem.readFile).toHaveBeenCalledTimes(2)
  expect(filesystem.lstat.mock.calls.filter(([file]) => file === source)).toHaveLength(1)
  expect(inputs.versions.has(source)).toBe(true)
  expect(inputs.versions.has(external)).toBe(true)
})
