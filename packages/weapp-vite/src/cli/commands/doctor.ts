import type { CAC } from 'cac'
import process from 'node:process'

export function registerDoctorCommand(cli: CAC) {
  cli.command('doctor [root]', '检查项目、源码、产物与显式选择的宿主证据')
    .option('--targets <targets>', '编译目标，逗号分隔（默认 weapp）')
    .option('--platform <platform>', '单个编译目标')
    .option('--source <directory>', '静态源码目录（默认 src，不执行配置推断）')
    .option('--artifact <directory>', '复用最终产物目录（新鲜度未验证）')
    .option('--build', '显式执行配置和构建，使用独立输出目录')
    .option('--runtime', '连接已打开项目的宿主探针，不启动 IDE')
    .option('--runtime-port <port>', '已有 automator 会话的端口（默认项目派生端口）')
    .option('--format <format>', 'terminal | json | sarif', { default: 'terminal' })
    .action(async (root, options) => {
      const { formatDoctorReport, runDoctor } = await import('../../doctor')
      const format = options.format
      if (!['terminal', 'json', 'sarif'].includes(format)) {
        process.stderr.write('doctor: format 必须为 terminal、json 或 sarif\n')
        process.exitCode = 2
        return
      }
      const report = await runDoctor({
        cwd: root,
        targets: String(options.targets ?? options.platform ?? 'weapp').split(',').map(item => item.trim()),
        source: options.source,
        artifact: options.artifact,
        build: options.build === true,
        runtime: options.runtime === true,
        configFile: options.config,
        runtimePort: options.runtimePort === undefined ? undefined : Number(options.runtimePort),
        onBuildLog: text => process.stderr.write(text),
      })
      process.stdout.write(`${formatDoctorReport(report, format)}\n`)
      process.exitCode = report.exitCode
    })
}
