import type { TemplateName } from '@weapp-core/init'
import type { CAC } from 'cac'
import { createProject } from '@weapp-core/init'

export function registerCreateCommand(cli: CAC) {
  cli
    .command('create [outDir]', 'create project')
    .option('-t, --template <type>', 'template type')
    .action(async (outDir: string, options: { template?: string }) => {
      await createProject(outDir, options.template as TemplateName)
    })
}
