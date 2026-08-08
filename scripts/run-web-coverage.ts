/* eslint-disable e18e/ban-dependencies -- Web coverage needs sequential package processes. */
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'

const ROOT = path.resolve(import.meta.dirname, '..')
const failures: string[] = []

async function run(label: string, command: string, args: string[]) {
  process.stdout.write(`[web-coverage] ${label}\n`)
  try {
    await execa(command, args, {
      cwd: ROOT,
      env: {
        ...process.env,
        WEAPP_VITE_WEB_COVERAGE_STRICT: '0',
      },
      stdio: 'inherit',
    })
  }
  catch (error) {
    failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function runFromPackage(label: string, packageDir: string, command: string, args: string[]) {
  process.stdout.write(`[web-coverage] ${label}\n`)
  try {
    await execa(command, args, {
      cwd: path.join(ROOT, packageDir),
      env: {
        ...process.env,
        WEAPP_VITE_WEB_COVERAGE_STRICT: '0',
      },
      stdio: 'inherit',
    })
  }
  catch (error) {
    failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

await run('@weapp-vite/web', 'pnpm', [
  '--filter',
  '@weapp-vite/web',
  'exec',
  'vitest',
  'run',
  '--coverage',
])
await run('@wevu/web-apis', 'pnpm', [
  '--filter',
  '@wevu/web-apis',
  'exec',
  'vitest',
  'run',
  '--coverage',
])
await runFromPackage('weapp-vite Web entrypoints', 'packages/weapp-vite', 'pnpm', [
  'exec',
  'vitest',
  'run',
  '-c',
  'vitest.web.config.ts',
  '--coverage',
])
await run('coverage manifest', 'pnpm', [
  'run',
  'check:web-coverage',
])

if (failures.length) {
  throw new Error(`Web coverage failed:\n${failures.join('\n\n')}`)
}
