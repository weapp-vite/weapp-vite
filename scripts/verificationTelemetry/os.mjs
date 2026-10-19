import assert from 'node:assert/strict'

const runtimeNames = new Map([['Linux', 'linux'], ['Windows', 'win32'], ['macOS', 'darwin'], ['linux', 'linux'], ['win32', 'win32'], ['darwin', 'darwin']])

/** 只接受 GitHub 官方 RUNNER_OS 或 Node 的明确枚举，拒绝猜测、大小写宽松匹配和未知平台。 */
export function runtimeOs(value) {
  assert(runtimeNames.has(value), 'Unknown verification operating system')
  return runtimeNames.get(value)
}

/** 精确核对实际版本与执行 profile，返回值保留 artifact 报告的原始平台名。 */
export function verificationResource(toolchain, profile) {
  const nodeVersion = toolchain.toolchain?.nodeVersion
  const packageManager = toolchain.toolchain?.actualPackageManager
  assert(runtimeOs(toolchain.os) === runtimeOs(profile?.os)
    && typeof toolchain.arch === 'string' && toolchain.arch && toolchain.arch === profile?.arch
    && /^v\d+\.\d+\.\d+(?:-[\w.-]+)?$/u.test(nodeVersion ?? '')
    && Number(nodeVersion.slice(1).split('.')[0]) === profile?.nodeMajor
    && /^pnpm@\d+\.\d+\.\d+(?:-[\w.-]+)?$/u.test(packageManager ?? ''), 'Verification actual resource/toolchain identity mismatch')
  return { os: toolchain.os, arch: toolchain.arch, nodeVersion, packageManager }
}
