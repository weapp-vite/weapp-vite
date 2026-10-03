import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { expect, it } from 'vitest'
import { captureSnapshotInputs, coversSnapshotInputs, validateSnapshotInputs } from './snapshotInputs'

it('checks source content, new files and external dependencies while excluding owned outputs', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'snapshot-inputs-'))
  const source = path.join(root, 'src')
  const external = path.join(root, 'node_modules/dependency.js')
  const outDir = path.join(source, 'dist')
  try {
    await mkdir(source)
    await mkdir(path.dirname(external))
    await mkdir(outDir)
    await writeFile(path.join(source, 'app.json'), '{}')
    await writeFile(external, 'export const value = 1')
    const scope = { roots: [source], files: [external], excluded: [outDir] }
    const inputs = await captureSnapshotInputs(scope)
    expect(coversSnapshotInputs(inputs, [external, path.join(source, 'app.json')])).toBe(true)
    expect(coversSnapshotInputs(inputs, [path.join(source, 'app.scss'), path.join(source, 'missing/index.jsonc')])).toBe(true)
    expect(coversSnapshotInputs(inputs, [path.join(root, 'undeclared.js')])).toBe(false)
    await writeFile(path.join(outDir, 'app.js'), 'output')
    expect(await validateSnapshotInputs(inputs)).toBe(true)
    await writeFile(external, 'export const value = 2')
    expect(await validateSnapshotInputs(inputs)).toBe(false)
    const updated = await captureSnapshotInputs(scope)
    await writeFile(path.join(source, 'new.vue'), '<template />')
    expect(await validateSnapshotInputs(updated)).toBe(false)
    const added = await captureSnapshotInputs(scope)
    await rm(path.join(source, 'new.vue'))
    expect(await validateSnapshotInputs(added)).toBe(false)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('still checks explicit dependencies inside excluded traversal directories', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'snapshot-dependencies-'))
  const dependencyRoot = path.join(root, 'node_modules')
  const file = path.join(dependencyRoot, 'index.js')
  try {
    await mkdir(dependencyRoot)
    await writeFile(file, 'before')
    const inputs = await captureSnapshotInputs({ roots: [root], files: [file], excluded: [], skipPaths: [dependencyRoot] })
    expect(inputs.versions.has(file)).toBe(true)
    expect(coversSnapshotInputs(inputs, [path.join(dependencyRoot, 'undeclared.js')])).toBe(false)
    await writeFile(file, 'after')
    expect(await validateSnapshotInputs(inputs)).toBe(false)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('matches physical dependencies to an aliased source tree and detects alias changes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'snapshot-alias-'))
  const source = path.join(root, 'source')
  const alias = path.join(root, 'alias')
  const replacement = path.join(root, 'replacement')
  try {
    await mkdir(source)
    await mkdir(replacement)
    await writeFile(path.join(source, 'index.js'), 'same source')
    await writeFile(path.join(replacement, 'index.js'), 'same source')
    await symlink(source, alias, 'junction')
    const inputs = await captureSnapshotInputs({ roots: [alias], files: [], excluded: [path.join(alias, 'dist')] })
    const physical = path.normalize(await realpath(source))
    expect(coversSnapshotInputs(inputs, [path.join(physical, 'index.js'), path.join(physical, 'index.scss')])).toBe(true)
    await mkdir(path.join(source, 'dist'))
    await writeFile(path.join(source, 'dist/index.js'), 'generated')
    expect(await validateSnapshotInputs(inputs)).toBe(true)
    await rm(alias)
    await symlink(replacement, alias, 'junction')
    expect(await validateSnapshotInputs(inputs)).toBe(false)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('does not hash an IDE lease unless a compiler declares it as an input', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'snapshot-ide-lease-'))
  const file = path.join(root, 'project.private.config.json')
  try {
    await writeFile(file, '{"watchOptions":{"ignore":["dist/**"]}}')
    const scope = { roots: [root], files: [], excluded: [], skipPaths: [file] }
    const implicit = await captureSnapshotInputs(scope)
    const declared = await captureSnapshotInputs({ ...scope, files: [file] })
    expect(coversSnapshotInputs(implicit, [file])).toBe(false)
    await writeFile(file, '{}')
    expect(await validateSnapshotInputs(implicit)).toBe(true)
    expect(await validateSnapshotInputs(declared)).toBe(false)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
