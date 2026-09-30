import type { CAC } from 'cac'

import { writeFile } from 'node:fs/promises'

import path from 'node:path'

import process from 'node:process'

export function registerAcceptCommand(cli: CAC) {
  cli.command('accept [root]', 'run deterministic mini-program acceptance without a model')
    .option('--init', 'create acceptance configuration without overwriting')
    .option('--inspect', 'inspect acceptance prerequisites without executing project code')
    .option('--report <jobId>', 'read a saved report and check source freshness')
    .option('--acceptance-config <file>', 'select an acceptance JSON configuration')
    .option('--trust', 'authorize the reviewed configuration for this invocation')
    .option('--json', 'write protocol data only to stdout')
    .action(async (root = '.', options) => {
      try {
        const directory = path.resolve(root)

        const { defaultVerification, detectProject, safePath } = await import('@weapp-vite/acceptance')

        if (options.init) {
          const target = await safePath(directory, options.acceptanceConfig ?? 'weapp-acceptance.config.json')

          const config = { version: 1, verification: defaultVerification(await detectProject(directory)), acceptance: { requiredChecks: ['build', 'devtools'], scenarios: [], timeoutMs: 600000 } }

          await writeFile(target, `${JSON.stringify(config, null, 2)}\n`, { flag: 'wx' })

          process.stdout.write(`${JSON.stringify({ created: target, modelRequired: false })}\n`)

          return
        }

        const { createRuntimeAcceptanceService } = await import('@weapp-vite/mcp')

        const { connectMiniProgram, prepareAcceptanceProject } = await import('weapp-ide-cli')

        const service = await createRuntimeAcceptanceService(directory, { trust: Boolean(options.trust && !options.inspect && !options.report), configFile: options.acceptanceConfig }, { connectMiniProgram, prepareProject: prepareAcceptanceProject })

        let jobId: string | undefined
        let cancelRequested = false

        const cancel = () => {
          cancelRequested = true
          if (jobId) {
            void service.cancel(jobId)
          }
        }

        process.once('SIGINT', cancel)

        try {
          let result

          if (options.inspect) {
            result = await service.inspect()
          }
          else
            if (options.report) {
              result = await service.report(options.report)
            }
            else {
              let report = await service.start()

              jobId = report.jobId
              if (cancelRequested) {
                await service.cancel(jobId)
              }

              while (report.status === 'running') {
                await new Promise(resolve => setTimeout(resolve, 100))

                report = await service.report(jobId)
              }

              result = report
            }

          process.stdout.write(`${JSON.stringify(result, null, options.json ? undefined : 2)}\n`)

          if ('passed' in result && (!result.passed || result.snapshot.stale)) {
            process.exitCode = 1
          }
        }
        finally {
          process.off('SIGINT', cancel)

          await service.close()
        }
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)

        if (options.json) {
          process.stdout.write(`${JSON.stringify({ status: 'failed', passed: false, reason: message })}\n`)
        }
        else {
          process.stderr.write(`${message}\n`)
        }

        process.exitCode = 1
      }
    })
}
