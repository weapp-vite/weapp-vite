// 此格式器也用于尚无 workspace 构建产物的安装阶段，不能依赖日志包的 dist。
import colors from 'picocolors'

/**
 * 格式化 Node.js 版本升级提示，供 CLI 与构建插件共用。
 * @param {string} name 发出提示的工具名称
 * @param {string} nodeVersion 当前 Node.js 版本
 * @param {string} nodeRange 官方支持的版本范围
 */
export function formatNodeVersionWarning(name, nodeVersion, nodeRange) {
  return [
    `${name} 检测到当前 Node.js 版本 ${colors.bold(colors.yellow(nodeVersion))} 不在官方支持范围内。`,
    `  推荐版本：${colors.bold(colors.cyan(nodeRange))}`,
    '  为获得安全修复，建议升级至受支持 LTS 分支的最新补丁版本。',
    `  ${colors.dim('本次将继续运行；若遇到依赖兼容问题，请先升级 Node.js。')}`,
  ].join('\n')
}
