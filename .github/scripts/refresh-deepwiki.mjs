import process from 'node:process'
import { runDeepWikiRefresh } from './deepwiki/diagnostics.mjs'

const result = await runDeepWikiRefresh()
process.exitCode = result.status === 'failed' ? 1 : 0
