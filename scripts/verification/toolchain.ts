import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 计划记录真实执行器版本，而非仅使用声明版本。
import { execa } from 'execa'

/** 固定缓存真实工具链身份，避免跨 Node、操作系统或架构复用结果。 */
export async function toolchainEnvironment(root: string): Promise<Record<string, string>> {
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as { packageManager: string }
  // pnpm 12 在 workspace 内查询版本也可能生成锁文件，探针使用自己的临时目录。
  const probe = await mkdtemp(path.join(os.tmpdir(), 'verification-toolchain-'))
  let actual: string
  try {
    await writeFile(path.join(probe, 'package.json'), JSON.stringify({ packageManager: manifest.packageManager }))
    actual = (await execa('pnpm', ['--version'], { cwd: probe })).stdout.trim()
  }
  finally {
    await rm(probe, { recursive: true, force: true })
  }
  if (manifest.packageManager.split('+')[0] !== `pnpm@${actual}`) {
    throw new Error('实际 pnpm 版本与 packageManager 声明不一致，请先同步工具链')
  }
  return {
    REPOCTL_RELEASE_NODE_VERSION: process.version,
    REPOCTL_RELEASE_PNPM_VERSION: `pnpm@${actual}`,
    REPOCTL_RELEASE_PLATFORM: process.platform,
    REPOCTL_RELEASE_ARCH: process.arch,
  }
}
