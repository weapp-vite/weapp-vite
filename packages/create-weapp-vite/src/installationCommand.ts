import process from 'node:process'

const SAFE_REGISTRY_RE = /^https?:\/\/[\w.:/-]+$/

/** 生成可复制的安装命令；Windows 的特殊地址使用明确标注的 PowerShell 语法。 */
export function installationCommand(registry?: string, platform = process.platform) {
  if (!registry) {
    return 'pnpm install'
  }
  if (SAFE_REGISTRY_RE.test(registry)) {
    return `pnpm --config.registry=${registry} install`
  }
  const quoted = platform === 'win32'
    ? `'${registry.replaceAll('\'', '\'\'')}'`
    : `'${registry.replaceAll('\'', '\'\\\'\'')}'`
  return `${platform === 'win32' ? 'PowerShell: ' : ''}pnpm --config.registry=${quoted} install`
}
