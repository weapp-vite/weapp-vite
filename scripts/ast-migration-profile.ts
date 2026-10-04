import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { runCompilerProfile } from './astMigrationProfile/runner'

export { profileCompileVueFilePhases, profileTransformScriptPhases } from './astMigrationProfile/profile'
export { runCompilerProfile } from './astMigrationProfile/runner'

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const argument = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.split('=')[1]
  runCompilerProfile({
    iterations: argument('iterations') === undefined ? undefined : Number(argument('iterations')),
    warmup: argument('warmup') === undefined ? undefined : Number(argument('warmup')),
  }).then((result) => {
    console.log(JSON.stringify(result, null, 2))
  }).catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
