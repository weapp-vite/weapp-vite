import type { CompilerContext } from '../../../context'

export function registerVueTemplateToken(
  ctx: CompilerContext,
  filename: string,
  template: string | undefined,
) {
  if (!template) {
    return
  }

  const wxmlService = (ctx as Partial<CompilerContext>).wxmlService
  if (!wxmlService) {
    return
  }

  try {
    const token = wxmlService.analyze(template)
    wxmlService.tokenMap.set(filename, token)
    wxmlService.setWxmlComponentsMap(filename, token.components)
  }
  catch {
    // 忽略模板扫描异常，避免阻断 Vue 编译流程
  }
}
