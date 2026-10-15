import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { runCompilerProfile } from './astMigrationProfile'

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCompilerProfile(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = 1
  })
}
