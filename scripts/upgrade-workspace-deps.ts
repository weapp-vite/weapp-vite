import process from 'node:process'
/* eslint-disable e18e/ban-dependencies -- cross-platform process launching should use execa per repository guidance. */
import { execa } from 'execa'

async function main() {
  const extraArgs = process.argv.slice(2)

  await execa('pnpm', ['up', '-r', '-L', '-i', ...extraArgs], {
    stdio: 'inherit',
  })

  await execa('node', ['--import', 'tsx', 'scripts/generate-dependency-upgrade-changeset.ts', '--base', 'HEAD'], {
    stdio: 'inherit',
  })

  await execa('node', ['--import', 'tsx', 'scripts/generate-catalog-changeset.ts', '--base', 'HEAD'], {
    stdio: 'inherit',
  })
}

await main()
