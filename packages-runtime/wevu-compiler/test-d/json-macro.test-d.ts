import { extractJsonMacroFromScriptSetup } from '@wevu/compiler'
import { expectType } from 'tsd'

void extractJsonMacroFromScriptSetup('definePageJson({ title: "literal" })', 'src/page.vue').then((result) => {
  expectType<true | undefined>(result.isStatic)
  expectType<Record<string, any> | undefined>(result.config)
  expectType<string[] | undefined>(result.dependencies)
  expectType<string>(result.stripped)
})
