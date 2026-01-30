import { readFileSync } from 'node:fs'

export const hasFs = typeof readFileSync === 'function'
