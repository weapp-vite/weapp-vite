#!/usr/bin/env -S npx tsx
import process from 'node:process'

async function run() {
  await import('../scripts/prepare-templates.ts')
  await import('../src/cli.ts')
}

run().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`)
  process.exitCode = 1
})
