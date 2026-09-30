import { appendFile } from 'node:fs/promises'
import process from 'node:process'
import { preparationInputs } from './preparation'

const { fingerprint } = await preparationInputs()
const key = `dimina-v1-${process.platform}-${process.arch}-${process.versions.node}-${fingerprint}`
console.log(key)
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `key=${key}\n`)
}
