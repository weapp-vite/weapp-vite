import process from 'node:process'
import { createProject } from '@weapp-core/init'

const [targetDir] = process.argv.slice(2)

async function main() {
  await createProject(targetDir)
}

main()
