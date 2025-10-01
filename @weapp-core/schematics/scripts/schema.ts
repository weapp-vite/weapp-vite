import process from 'node:process'
import { buildSchemas } from './utils'

buildSchemas().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
