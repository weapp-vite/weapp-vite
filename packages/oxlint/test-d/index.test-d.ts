import type { OxlintConfig } from 'vite-plus/lint'
import { miniProgramRecommended, reactRecommended, wevuRecommended } from '@weapp-vite/oxlint'
import plugin from '@weapp-vite/oxlint/plugin'
import { expectAssignable } from 'tsd'

expectAssignable<OxlintConfig>(miniProgramRecommended)
expectAssignable<OxlintConfig>(wevuRecommended)
expectAssignable<OxlintConfig>(reactRecommended)
expectAssignable<string>(plugin.meta.name)
expectAssignable<(...args: never[]) => unknown>(plugin.rules['no-unsupported-runtime-api'].create)
expectAssignable<(...args: never[]) => unknown>(plugin.rules['no-implicit-runtime-polyfill'].create)
expectAssignable<(...args: never[]) => unknown>(plugin.rules['no-unsupported-api'].create)
expectAssignable<(...args: never[]) => unknown>(plugin.rules['no-risky-api'].create)
