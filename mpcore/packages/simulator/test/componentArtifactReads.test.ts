import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createFileSystemArtifactSource, createMemoryArtifactSource } from '../src/kernel'
import { createArtifactProject } from '../src/project'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs } from './helpers'
import { componentArtifactReadFiles } from './helpers/componentArtifactReads'

const directories: string[] = []
afterEach(() => cleanupTempDirs(directories))

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-component-artifacts-'))
  directories.push(root)
  const memory = createMemoryArtifactSource(componentArtifactReadFiles.map(([file, source]): [string, string] => [path.join(root, file), source]))
  const artifactSource = { has: vi.fn(memory.has), readText: vi.fn(memory.readText) }
  const project = createArtifactProject({ miniprogramRootPath: root, artifactSource })
  const session = createHeadlessSession({ project })
  const componentPath = path.join(root, 'miniprogram_npm/probe-card/index.js')
  const dependencyPath = path.join(root, 'miniprogram_npm/probe-card/label.js')
  return { session, artifactSource, componentPath, dependencyPath }
}

it('reads and executes a resolved npm component and its required module from the artifact source', () => {
  const { session, artifactSource, componentPath, dependencyPath } = fixture()
  try {
    session.reLaunch('/pages/index/index')
    expect(session.selectComponent('#probe')?.data).toMatchObject({ label: 'module-source-loaded', relativeLabel: 'relative-directory-source', npmLabel: 'npm-directory-source', count: 0 })
    expect(session.renderCurrentPage().wxml).toContain('module-source-loaded/0')
    expect(artifactSource.readText).toHaveBeenCalledWith(componentPath)
    expect(artifactSource.readText).toHaveBeenCalledWith(dependencyPath)
    expect(session.getDiagnostics()).toEqual([])
  }
  finally {
    session.close()
  }
})

it('uses artifact existence probes without rereading JavaScript while rendering a cached component', () => {
  const { session, artifactSource, componentPath } = fixture()
  try {
    session.reLaunch('/pages/index/index')
    const component = session.selectComponent('#probe')!
    artifactSource.has.mockClear()
    artifactSource.readText.mockClear()

    component.setData({ count: 1 })
    expect(session.renderCurrentPage().wxml).toContain('module-source-loaded/1')
    component.setData({ count: 2 })
    expect(session.renderCurrentPage().wxml).toContain('module-source-loaded/2')

    expect(artifactSource.has.mock.calls.map(([file]) => path.normalize(file))).toContain(componentPath)
    expect(artifactSource.readText.mock.calls.filter(([file]) => file.endsWith('.js'))).toEqual([])
    expect(session.selectComponent('#probe')).toBe(component)
    expect(session.getDiagnostics()).toEqual([])
  }
  finally {
    session.close()
  }
})

it('reads required JavaScript once for execution after resolving its extension with artifact existence probes', () => {
  const { session, artifactSource, dependencyPath } = fixture()
  try {
    session.reLaunch('/pages/index/index')
    expect(session.selectComponent('#probe')?.data.label).toBe('module-source-loaded')
    expect(artifactSource.has.mock.calls.map(([file]) => path.normalize(file))).toContain(dependencyPath)
    expect(artifactSource.readText.mock.calls.map(([file]) => path.normalize(file)).filter(file => file === dependencyPath)).toEqual([dependencyPath])
  }
  finally {
    session.close()
  }
})

it('resolves the rendered alias without probing unused component declarations', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-unused-component-artifacts-'))
  directories.push(root)
  const files = componentArtifactReadFiles.map(([file, source]): [string, string] => [path.join(root, file), file === 'pages/index/index.json'
    ? JSON.stringify({ usingComponents: { 'probe-card': 'probe-card', 'unused-card': 'unused-card' } })
    : source])
  const memory = createMemoryArtifactSource(files)
  const artifactSource = { has: vi.fn(memory.has), readText: vi.fn(memory.readText) }
  const session = createHeadlessSession({ project: createArtifactProject({ miniprogramRootPath: root, artifactSource }) })
  try {
    session.reLaunch('/pages/index/index')
    expect(session.renderCurrentPage().wxml).toContain('module-source-loaded/0')
    session.selectComponent('#probe')!.setData({ count: 1 })
    expect(session.renderCurrentPage().wxml).toContain('module-source-loaded/1')
    expect(artifactSource.has.mock.calls.filter(([file]) => file.includes('unused-card'))).toEqual([])
    expect(session.getDiagnostics()).toEqual([])
  }
  finally {
    session.close()
  }
})

it('treats filesystem artifacts as files rather than existing directories', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-artifact-file-kind-'))
  directories.push(root)
  const file = path.join(root, 'index.js')
  fs.writeFileSync(file, 'module.exports = "file"')
  const source = createFileSystemArtifactSource()
  expect(source.has(root)).toBe(false)
  expect(source.has(file)).toBe(true)
  expect(source.has(path.join(root, 'missing.js'))).toBe(false)
})

it.each([
  ['./relative-label', 'relative-directory-source'],
  ['probe-label', 'npm-directory-source'],
] as const)('resolves a filesystem directory require for %s to its executable index file', (request, label) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-directory-require-'))
  directories.push(root)
  for (const [file, content] of componentArtifactReadFiles) {
    const target = path.join(root, file)
    const source = file === 'miniprogram_npm/probe-card/index.js'
      ? `Component({ data: { label: require(${JSON.stringify(request)}), count: 0 } })`
      : content
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, source)
  }
  const artifactSource = createFileSystemArtifactSource()
  const read = vi.spyOn(artifactSource, 'readText')
  const session = createHeadlessSession({ project: createArtifactProject({ miniprogramRootPath: root, artifactSource }) })
  try {
    session.reLaunch('/pages/index/index')
    expect(session.selectComponent('#probe')?.data).toMatchObject({ label, count: 0 })
    expect(session.renderCurrentPage().wxml).toContain(`${label}/0`)
    const directory = path.join(root, request.startsWith('.') ? 'miniprogram_npm/probe-card/relative-label' : 'miniprogram_npm/probe-label')
    const reads = read.mock.calls.map(([file]) => path.normalize(file))
    expect(reads).not.toContain(directory)
    expect(reads.filter(file => file === path.join(directory, 'index.js'))).toEqual([path.join(directory, 'index.js')])
    expect(session.getDiagnostics()).toEqual([])
  }
  finally {
    session.close()
  }
})
