import type { createCompilerContext } from 'weapp-vite'
import { expectAssignable, expectError, expectType } from 'tsd'

type CompilerContext = Awaited<ReturnType<typeof createCompilerContext>>
type HmrState = CompilerContext['runtimeState']['build']['hmr']
type TailwindKeys = 'tailwindPrepareMs' | 'tailwindGenerateMs' | 'tailwindCssMs'
  | 'tailwindTemplateMs' | 'tailwindJavaScriptMs' | 'tailwindFinalizeMs'
  | 'tailwindSourceResolveMs' | 'tailwindDiskGenerateMs'
type TailwindProfile = Pick<HmrState['profile'], TailwindKeys>

declare const profile: HmrState['profile'] | HmrState['recentProfiles'][number]

expectType<number | undefined>(profile.tailwindPrepareMs)
expectType<number | undefined>(profile.tailwindGenerateMs)
expectType<number | undefined>(profile.tailwindCssMs)
expectType<number | undefined>(profile.tailwindTemplateMs)
expectType<number | undefined>(profile.tailwindJavaScriptMs)
expectType<number | undefined>(profile.tailwindFinalizeMs)
expectType<number | undefined>(profile.tailwindSourceResolveMs)
expectType<number | undefined>(profile.tailwindDiskGenerateMs)
expectAssignable<TailwindProfile>({})
expectAssignable<TailwindProfile>({ tailwindPrepareMs: 0, tailwindDiskGenerateMs: 1 })
expectError<TailwindProfile>({ tailwindCssMs: 'slow' })
