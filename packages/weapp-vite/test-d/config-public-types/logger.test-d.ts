import type picocolors from 'picocolors'
import { colors } from '@weapp-core/logger'
import { expectType } from 'tsd'

expectType<typeof picocolors>(colors)
expectType<string>(colors.green('ready'))
expectType<string>(colors.createColors(false).red('failed'))
