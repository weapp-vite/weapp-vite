import { createHash } from 'node:crypto'
import { readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { WINDOWS_PROCESS_ROWS_HEADER } from './windowsProcessRows'

export const WINDOWS_KERNEL_TOOL_ROOT = '.cache/e2e-native/windows-kernel-inspector'
export const WINDOWS_KERNEL_SOURCE = 'e2e/utils/devProcessCleanup/windowsKernelQuery.cs'
export const WINDOWS_KERNEL_COMPILER_FLAGS = ['/nologo', '/codepage:65001', '/utf8output', '/optimize+', '/target:exe', '/platform:anycpu'] as const
export const WINDOWS_KERNEL_COMPILE_TIMEOUT_MS = 30_000
export const WINDOWS_KERNEL_WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))

export interface WindowsKernelArtifactManifest {
  schemaVersion: 1
  tool: 'windows-kernel-inspector'
  logicalRoot: 'workspace'
  source: { path: string, sha256: string }
  flags: readonly string[]
  flagsSha256: string
  wire: string
  imageSha256: string
  compiler: { relativePath: string, sha256: string }
  provenance: { commit: string, runId: string | null, runAttempt: string | null, os: string, arch: string, node: string }
}

export function windowsKernelDigest(bytes: string | Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function workspaceFile(root: string, name: string): string {
  const candidate = join(root, name)
  const actual = realpathSync(candidate)
  const within = relative(realpathSync(root), actual)
  if (isAbsolute(within) || within === '..' || within.startsWith(`..${sep}`) || !statSync(actual).isFile()) {
    throw new Error(`Windows kernel inspector artifact escapes its workspace: ${name}`)
  }
  return actual
}

/** 校验的字节直接交给本次查询；存在文件或时间戳不能代替输入及来源核验。 */
export function readWindowsKernelInspector(root = WINDOWS_KERNEL_WORKSPACE, env = process.env): Uint8Array {
  try {
    const manifest = JSON.parse(readFileSync(workspaceFile(root, `${WINDOWS_KERNEL_TOOL_ROOT}/manifest.json`), 'utf8')) as WindowsKernelArtifactManifest
    const image = readFileSync(workspaceFile(root, `${WINDOWS_KERNEL_TOOL_ROOT}/snapshot.exe`))
    const source = readFileSync(workspaceFile(root, WINDOWS_KERNEL_SOURCE))
    const flags = JSON.stringify(WINDOWS_KERNEL_COMPILER_FLAGS)
    if (manifest.schemaVersion !== 1 || manifest.tool !== 'windows-kernel-inspector' || manifest.logicalRoot !== 'workspace'
      || manifest.source?.path !== WINDOWS_KERNEL_SOURCE || manifest.source.sha256 !== windowsKernelDigest(source)
      || JSON.stringify(manifest.flags) !== flags || manifest.flagsSha256 !== windowsKernelDigest(flags)
      || manifest.wire !== WINDOWS_PROCESS_ROWS_HEADER || manifest.imageSha256 !== windowsKernelDigest(image)
      || !/^[a-f\d]{64}$/u.test(manifest.compiler?.sha256 ?? '')
      || !/^Microsoft\.NET\/(?:Framework|Framework64)\/v4\.0\.30319\/csc\.exe$/u.test(manifest.compiler?.relativePath ?? '')
      || !manifest.provenance || manifest.provenance.os !== 'win32' || manifest.provenance.arch !== process.arch
      || !/^[a-f\d]{40}$/u.test(manifest.provenance.commit) || !/^v\d+\.\d+\.\d+/u.test(manifest.provenance.node)) {
      throw new Error('Windows kernel inspector artifact input, image or provenance mismatch.')
    }
    for (const [key, expected] of [
      ['commit', env.BUILD_ARTIFACT_EXPECTED_COMMIT ?? env.GITHUB_SHA],
      ['runId', env.GITHUB_RUN_ID],
      ['runAttempt', env.GITHUB_RUN_ATTEMPT],
    ] as const) {
      if (expected && manifest.provenance[key] !== expected) {
        throw new Error(`Windows kernel inspector artifact provenance mismatch: ${key}`)
      }
    }
    return image
  }
  catch (cause) {
    throw new Error('Windows kernel inspector is missing, stale or invalid. Run `pnpm e2e:build-tools` before Windows E2E/HMR validation.', { cause })
  }
}

/** 所有复用 dev controller 的本地入口都在派发子进程之前核验工具。 */
export function assertWindowsKernelInspectorReady(): void {
  if (process.platform === 'win32') {
    readWindowsKernelInspector()
  }
}
