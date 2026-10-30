#!/usr/bin/env node
import process from 'node:process'
import { runLint } from './project'

runLint(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
