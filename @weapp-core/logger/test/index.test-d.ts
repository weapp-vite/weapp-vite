import { colors } from '@weapp-core/logger'
import { expectType } from 'tsd'

expectType<string>(colors.green('upload'))
expectType<string>(colors.bold(123))
expectType<string>(colors.createColors(false).red('failed'))
expectType<boolean>(colors.isColorSupported)
