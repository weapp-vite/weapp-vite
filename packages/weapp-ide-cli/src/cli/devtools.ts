import { listWechatDevtoolsInstallations, registerWechatDevtoolsInstallation, unregisterWechatDevtoolsInstallation } from '../devtoolsTarget'

/** 本地安装管理不启动 IDE，不更改账号或默认 CLI 配置。 */
export async function handleDevtoolsCommand(argv: readonly string[]) {
  const [action = 'list', cliPath] = argv
  if (action === 'list') {
    const installations = await listWechatDevtoolsInstallations()
    if (argv.includes('--json')) {
      console.log(JSON.stringify({ installations }, null, 2))
    }
    else {
      for (const entry of installations) {
        console.log(entry.target
          ? `${entry.target.channel ?? 'unknown'}@${entry.target.version ?? 'unknown'}\n  CLI: ${entry.cliPath}\n  installation: ${entry.target.installationId}\n  profile: ${entry.target.profileDir}`
          : `unavailable: ${entry.cliPath}\n  ${entry.error}`)
      }
    }
    return
  }
  if (action !== 'add' && action !== 'remove') {
    throw new Error('Use weapp devtools list [--json] | add <path-to-cli> | remove <path-to-cli>.')
  }
  if (!cliPath || argv.length !== 2) {
    throw new Error(`weapp devtools ${action} requires one CLI path.`)
  }
  if (action === 'add') {
    console.log(JSON.stringify(await registerWechatDevtoolsInstallation(cliPath), null, 2))
  }
  else {
    await unregisterWechatDevtoolsInstallation(cliPath)
  }
}
