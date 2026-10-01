import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 保留 Windows 命令解析和超时取消当前 CLI 的语义。
import { execa } from 'execa'

/** 轮播只使用本轮核验后显式选择的 CLI，不修改用户的全局 IDE 配置。 */
export function resolveChunkModesIdeCli(env = process.env) {
  const cliPath = env.WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH?.trim()
  if (!cliPath) {
    throw new Error('打开场景前，请核对官方最新稳定版并设置 WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH；只有明确指定时才使用其他版本。')
  }
  return cliPath
}

/** 只打开目标项目；CLI 失败直接报告，不关闭或重启共享 IDE。 */
export async function openChunkModesIde(projectPath, cliPath) {
  await execa(cliPath, ['open', '-p', projectPath], {
    stdio: 'inherit',
    timeout: 120_000,
  })
}
