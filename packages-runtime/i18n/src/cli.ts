#!/usr/bin/env node
import process from 'node:process'
import { parseArgs } from 'node:util'
import { compileNativeI18n } from './native'

function printHelp() {
  console.log(`weapp-i18n compile --src-root <dir> --default-locale <locale> [options]

Options:
  --fallback-locale <locale>  Fallback locale, defaults to defaultLocale
  --out-dir <dir>             Generated asset directory, defaults to <src-root>/i18n
  --help                      Show this help
`)
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  if (!command || command === '--help' || command === '-h') {
    printHelp()
    return
  }
  if (command !== 'compile') {
    throw new Error(`未知命令：${command}`)
  }

  const parsed = parseArgs({
    args,
    options: {
      'default-locale': { type: 'string' },
      'fallback-locale': { type: 'string' },
      'help': { type: 'boolean', short: 'h' },
      'out-dir': { type: 'string' },
      'src-root': { type: 'string' },
    },
    strict: true,
  })
  if (parsed.values.help) {
    printHelp()
    return
  }
  const srcRoot = parsed.values['src-root']
  const defaultLocale = parsed.values['default-locale']
  if (!srcRoot || !defaultLocale) {
    throw new Error('compile 需要 --src-root 和 --default-locale。')
  }

  const result = await compileNativeI18n({
    defaultLocale,
    fallbackLocale: parsed.values['fallback-locale'],
    outDir: parsed.values['out-dir'],
    srcRoot,
  })
  console.log(`generated ${result.jsFile}`)
  console.log(`generated ${result.wxsFile}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
