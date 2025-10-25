import type { RolldownOutput } from 'rolldown'

declare const output: RolldownOutput

output.output[0].type satisfies 'chunk' | 'asset'
