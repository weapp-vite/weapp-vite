import { Buffer } from 'node:buffer'
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { createWindowsKernelArtifactFixture, KERNEL_FIXTURE_COMMIT, KERNEL_FIXTURE_IMAGE } from '../testSupport/windowsKernelArtifact'
import { readWindowsKernelInspector, WINDOWS_KERNEL_SOURCE, WINDOWS_KERNEL_TOOL_ROOT } from './windowsKernelArtifact'

const directories: string[] = []
const env = { BUILD_ARTIFACT_EXPECTED_COMMIT: KERNEL_FIXTURE_COMMIT, GITHUB_RUN_ID: '12', GITHUB_RUN_ATTEMPT: '2' }

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'kernel-artifact-contract-'))
  directories.push(root)
  return { root, manifest: await createWindowsKernelArtifactFixture(root) }
}

it('returns exactly the bytes bound to current inputs and frozen build provenance', async () => {
  const { root } = await fixture()
  expect(Buffer.from(readWindowsKernelInspector(root, env)).toString()).toBe(KERNEL_FIXTURE_IMAGE)
  expect(() => readWindowsKernelInspector(root, { ...env, GITHUB_RUN_ID: '13' })).toThrow(/build-tools/)
  expect(() => readWindowsKernelInspector(root, { ...env, GITHUB_RUN_ATTEMPT: '3' })).toThrow(/build-tools/)
  expect(() => readWindowsKernelInspector(root, { ...env, BUILD_ARTIFACT_EXPECTED_COMMIT: 'b'.repeat(40) })).toThrow(/build-tools/)
})

it.each(['source', 'flags', 'wire', 'image', 'root', 'schema', 'compiler'] as const)('rejects %s drift with an explicit rebuild command', async (kind) => {
  const { root, manifest } = await fixture()
  if (kind === 'source') {
    await writeFile(join(root, WINDOWS_KERNEL_SOURCE), 'changed source')
  }
  else if (kind === 'image') {
    await writeFile(join(root, WINDOWS_KERNEL_TOOL_ROOT, 'snapshot.exe'), 'changed executable')
  }
  else {
    const changed: Record<string, unknown> = { ...manifest }
    if (kind === 'flags') {
      changed.flags = [...manifest.flags, '/debug+']
    }
    if (kind === 'wire') {
      changed.wire = 'other-wire'
    }
    if (kind === 'root') {
      changed.logicalRoot = 'other-workspace'
    }
    if (kind === 'schema') {
      changed.schemaVersion = 2
    }
    if (kind === 'compiler') {
      changed.compiler = {
        ...manifest.compiler,
        sha256: 'invalid',
      }
    }
    await writeFile(join(root, WINDOWS_KERNEL_TOOL_ROOT, 'manifest.json'), JSON.stringify(changed))
  }
  expect(() => readWindowsKernelInspector(root, env)).toThrow(/pnpm e2e:build-tools/)
})

it('rejects missing manifests and symlinks escaping the logical workspace', async (context) => {
  const { root } = await fixture()
  const { root: other } = await fixture()
  await rm(join(root, WINDOWS_KERNEL_TOOL_ROOT, 'manifest.json'))
  expect(() => readWindowsKernelInspector(root, env)).toThrow(/build-tools/)
  try {
    await symlink(join(other, WINDOWS_KERNEL_TOOL_ROOT, 'manifest.json'), join(root, WINDOWS_KERNEL_TOOL_ROOT, 'manifest.json'))
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EPERM') {
      context.skip('This runner does not grant file symlink creation')
      return
    }
    throw error
  }
  expect(() => readWindowsKernelInspector(root, env)).toThrow(/build-tools/)
  expect(await readFile(join(other, WINDOWS_KERNEL_TOOL_ROOT, 'snapshot.exe'), 'utf8')).toBe(KERNEL_FIXTURE_IMAGE)
})
