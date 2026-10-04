import { realpath } from 'node:fs/promises'
import process from 'node:process'
import { getConfig } from 'weapp-ide-cli'
import { applyWechatCliSelection } from './devtoolsCli'

/** 校验公共 CLI 与本轮 E2E 显式选择同一安装，不修改用户的全局配置。 */
export async function assertPublicIdeCliSelection() {
  const selectedCli = process.env.WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH?.trim()
  if (!selectedCli) {
    throw new Error('公共 CLI E2E 需要显式设置 WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH，先核对官方最新稳定版。')
  }
  applyWechatCliSelection()
  const { cliPath } = await getConfig()
  if (!cliPath) {
    throw new Error('公共 CLI 未识别本轮开发者工具选择；请重建 weapp-ide-cli 后重试。')
  }
  const [selected, configured] = await Promise.all([realpath(selectedCli), realpath(cliPath)])
  if (selected !== configured) {
    throw new Error('公共 CLI 与 E2E 选择了不同的开发者工具，已停止启动；请重建 weapp-ide-cli 并核对本轮选择。')
  }
}
