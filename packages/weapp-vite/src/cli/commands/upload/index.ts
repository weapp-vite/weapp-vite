import type { CAC } from 'cac'
import type { UploadCLIOptions } from '../../upload/options'
import type { UploadReport } from '../../upload/report'
import type { UploadAction } from '../../upload/types'
import { readUploadMetadata } from '../../upload/options'
import { scheduleCompletedProductionBuildExit } from '../build'

export function runUploadCommand(root: string | undefined, options: UploadCLIOptions, action?: 'upload'): Promise<UploadReport>
export function runUploadCommand(root: string | undefined, options: UploadCLIOptions, action: 'preview'): Promise<void>
export function runUploadCommand(root: string | undefined, options: UploadCLIOptions, action: UploadAction): Promise<UploadReport | void>
/** 按实际上传或预览调用加载执行层，保留原有返回值重载。 */
export async function runUploadCommand(root: string | undefined, options: UploadCLIOptions, action: UploadAction = 'upload'): Promise<UploadReport | void> {
  const { runUploadCommand } = await import('./action')
  return runUploadCommand(root, options, action)
}

export function registerUploadCommand(cli: CAC) {
  cli
    .command('upload [root]', 'build and upload mini programs (does not submit for review or publish)')
    .option('-p, --platform <platform>', '[string] weapp | alipay | tt | xhs | jd | swan; comma-separated targets or all')
    .option('--project-config <path>', '[string] project config path')
    .option('--uv <version>', '[string] upload version (default: weapp.upload.version or package.json version)')
    .option('--desc <text>', '[string] upload description (default: weapp.upload.desc or project name and version)')
    .option('--bump <release>', '[string] increment local package version once (patch | minor | major; dry-run does not write)')
    .option('--git-desc', '[boolean] use the latest Git commit subject as upload description')
    .option('--dry-run', '[boolean] build without validating upload credentials or uploading')
    .option('--json', '[boolean] write one upload report to stdout; send logs to stderr')
    .option('--timeout <seconds>', '[number] local timeout per platform SDK invocation, excluding build')
    .example('wv upload -p weapp')
    .example('wv upload -p xhs,tt --bump patch --git-desc --dry-run')
    .example('wv upload --project ./dist --version 1.2.3 --desc "release"  (deprecated IDE syntax; use wv ide upload to retain IDE behavior)')
    .action(async (root: string | undefined, options: UploadCLIOptions) => {
      return runUploadCommand(root, { ...options, ...readUploadMetadata(cli) })
    })
}

export function registerPreviewCommand(cli: CAC) {
  cli
    .command('preview [root]', 'build mini programs and generate preview QR codes or links')
    .option('-p, --platform <platform>', '[string] weapp | alipay | tt | xhs | jd | swan; comma-separated targets or all')
    .option('--project-config <path>', '[string] project config path')
    .option('--desc <text>', '[string] preview description')
    .option('--dry-run', '[boolean] build without validating credentials or generating previews')
    .action(async (root: string | undefined, options: UploadCLIOptions) => {
      await runUploadCommand(root, { ...options, ...readUploadMetadata(cli) }, 'preview')
      scheduleCompletedProductionBuildExit({}, undefined)
    })
}
