import type { CreateProjectOptions } from 'create-weapp-vite'
import { createProject, TemplateName } from 'create-weapp-vite'
import { expectAssignable, expectError, expectType } from 'tsd'

expectAssignable<TemplateName>(TemplateName.default)
expectAssignable<TemplateName>(TemplateName.multiPlatform)
expectAssignable<TemplateName>(TemplateName.multiPlatformSfc)
expectAssignable<TemplateName>(TemplateName.plugin)
expectAssignable<TemplateName>(TemplateName.wevu)
expectAssignable<TemplateName>(TemplateName.react)

expectType<Promise<void>>(createProject('/tmp/demo', TemplateName.default))
expectType<Promise<void>>(createProject('/tmp/demo', TemplateName.multiPlatform))
expectType<Promise<void>>(createProject('/tmp/demo', TemplateName.multiPlatformSfc))

const options: CreateProjectOptions = {
  installSkills: true,
}
expectType<boolean | undefined>(options.installSkills)
expectType<Promise<void>>(createProject('/tmp/demo', TemplateName.wevu, options))

expectError(createProject('/tmp/demo', 'unknown-template'))
