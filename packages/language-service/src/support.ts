import { FILTER_EXTENSIONS, languageProfiles } from './profiles'
import { getComponentSchema } from './schema'

/** 案例 ID 指向可执行的回归入口；覆盖结论限定于这些语言契约。 */
export const languageSupportCases = [
  { id: 'template-platform-contract', scenario: '平台指令、循环作用域、事件及无损幂等格式', test: 'packages/language-service/src/template/index.test.ts', suite: 'platform template contracts' },
  { id: 'template-protected-source', scenario: '文本空白、插值、脚本、注释、CDATA、实体及换行保护', test: 'packages/language-service/src/template/index.test.ts', suite: 'lossless layout' },
  { id: 'template-invalid-source', scenario: '词法、表达式、条件链、重复指令、绑定及原生模块诊断', test: 'packages/language-service/src/template/index.test.ts', suite: 'strict rejection' },
  { id: 'template-seeded-combinations', scenario: '固定种子 0x5eed2026，每平台 128 组组合；逐字保护、幂等及无效输入拒写', test: 'packages/language-service/src/template/combinations.test.ts', suite: 'seeded lossless template combinations' },
  { id: 'script-platform-contract', scenario: '平台脚本语法、运行时边界、引用及符号', test: 'packages/language-service/src/script.test.ts', suite: 'platform script diagnostics' },
  { id: 'script-dialect-contract', scenario: '原生方言与编译源码边界及平台差异', test: 'packages/language-service/src/scriptDialect.test.ts', suite: 'native WXS and compiled source boundaries' },
  { id: 'script-format-contract', scenario: '注入格式器、结构一致性及不安全修改拒绝', test: 'packages/language-service/src/script.test.ts', suite: 'injected script formatting' },
  { id: 'script-cross-module-symbols', scenario: 'ESM 与 require 静态绑定、遮蔽、成员及跨文件重命名范围', test: 'packages/language-service/src/script/moduleFacts.test.ts', suite: 'cross-module script symbol facts' },
  { id: 'project-owner-contract', scenario: '项目配置、共享脚本归属、引用闭环及未保存文档', test: 'packages/language-service/src/project/index.test.ts', suite: 'project document ownership' },
  { id: 'document-format-contract', scenario: '模板、脚本及原生样式集成和样式结构保护', test: 'packages/oxfmt/src/languages/index.test.ts', suite: 'shared multi-platform formatter' },
  { id: 'offline-component-schema', scenario: '平台专属组件数据、属性与来源元数据', test: 'packages/language-service/src/schema/index.test.ts', suite: 'platform component snapshots' },
] as const

/** 此矩阵描述可审计的静态语言能力，不将其等同于所有宿主的渲染结果证明。 */
export function getLanguageSupportMatrix() {
  return languageProfiles.map(profile => ({
    platform: profile.platform,
    buildSupport: profile.support,
    templateExtensions: [...profile.templateExtensions],
    styleExtensions: [...profile.styleExtensions],
    scriptExtensions: [...profile.scriptExtensions],
    filterExtensions: profile.platform === 'swan' ? [...FILTER_EXTENSIONS] : [],
    compiledScriptSuffixes: ['.js', '.ts'],
    cases: languageSupportCases.map(testCase => testCase.id),
    componentSchema: getComponentSchema(profile.platform).availability,
    documentation: profile.documentation.map(source => ({ ...source })),
  }))
}
