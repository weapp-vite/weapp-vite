#!/usr/bin/env node
import process from 'node:process'
import { runFormat } from './project'

runFormat(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
