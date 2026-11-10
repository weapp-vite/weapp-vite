import process from 'node:process'
import { exec } from 'tinyexec'
import { COMPONENT_OUTPUT_FILES, planComponentChangeset, writeComponentChangeset } from './builtin/changeset'

async function main() {
  const { stdout: paths } = await exec('git', ['diff', '--name-only', 'HEAD', '--', ...COMPONENT_OUTPUT_FILES], { throwOnError: true })
  const { stdout: diff } = await exec('git', ['diff', '--no-ext-diff', '--no-color', 'HEAD', '--', ...COMPONENT_OUTPUT_FILES], { throwOnError: true })
  const plan = planComponentChangeset(paths.split(/\r?\n/), diff)
  if (plan) {
    await writeComponentChangeset(plan)
    console.log(`[wechat-components] generated ${plan.path}`)
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
