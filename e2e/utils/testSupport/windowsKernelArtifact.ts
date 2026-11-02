import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { WINDOWS_KERNEL_COMPILER_FLAGS, WINDOWS_KERNEL_SOURCE, WINDOWS_KERNEL_TOOL_ROOT } from '../devProcessCleanup/windowsKernelArtifact'
import { WINDOWS_PROCESS_ROWS_HEADER } from '../devProcessCleanup/windowsProcessRows'

export const KERNEL_FIXTURE_COMMIT = 'a'.repeat(40)
export const KERNEL_FIXTURE_IMAGE = 'MZ kernel inspector fixture'

/** 仅构造独立测试工作区，不修改共享构建产物。 */
export async function createWindowsKernelArtifactFixture(root: string) {
  const digest = (value: string) => createHash('sha256').update(value).digest('hex')
  const source = `private const string Header = "${WINDOWS_PROCESS_ROWS_HEADER}";\n`
  await mkdir(dirname(join(root, WINDOWS_KERNEL_SOURCE)), { recursive: true })
  await mkdir(join(root, WINDOWS_KERNEL_TOOL_ROOT), { recursive: true })
  await writeFile(join(root, WINDOWS_KERNEL_SOURCE), source)
  await writeFile(join(root, WINDOWS_KERNEL_TOOL_ROOT, 'snapshot.exe'), KERNEL_FIXTURE_IMAGE)
  const manifest = {
    schemaVersion: 1,
    tool: 'windows-kernel-inspector',
    logicalRoot: 'workspace',
    source: { path: WINDOWS_KERNEL_SOURCE, sha256: digest(source) },
    flags: [...WINDOWS_KERNEL_COMPILER_FLAGS],
    flagsSha256: digest(JSON.stringify(WINDOWS_KERNEL_COMPILER_FLAGS)),
    wire: WINDOWS_PROCESS_ROWS_HEADER,
    imageSha256: digest(KERNEL_FIXTURE_IMAGE),
    compiler: { relativePath: `Microsoft.NET/${process.arch === 'ia32' ? 'Framework' : 'Framework64'}/v4.0.30319/csc.exe`, sha256: digest('compiler fixture') },
    provenance: { commit: KERNEL_FIXTURE_COMMIT, runId: '12', runAttempt: '2', os: 'win32', arch: process.arch, node: process.version },
  }
  await writeFile(join(root, WINDOWS_KERNEL_TOOL_ROOT, 'manifest.json'), JSON.stringify(manifest))
  return manifest
}
