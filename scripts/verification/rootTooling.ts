const ROOT_HOOK_INPUTS = new Set([
  'lefthook.yml',
  'scripts/gitHooks/rc.sh',
  'scripts/gitHooks/commitMsg.mjs',
  'scripts/gitHooks/README.md',
  'scripts/gitHooks.test.ts',
  'scripts/changesetFrontmatter/test/fixture.ts',
  'scripts/changesetFrontmatter/test/staged.ts',
  'scripts/check-changeset-frontmatter.test.ts',
])

const ROOT_HOOK_TESTS = [
  'scripts/check-changeset-frontmatter.test.ts',
  'scripts/gitHooks.test.ts',
]

/** 已审计的 Git hook 输入由根工具契约拥有，未知路径仍保守扩大范围。 */
export function isRootToolingInput(file: string): boolean {
  return ROOT_HOOK_INPUTS.has(file)
}

/** 共享 fixture 的直接与间接消费者都必须执行，删除及重命名旧端也保留契约。 */
export function rootToolingContractTests(files: string[]): string[] {
  return files.some(isRootToolingInput) ? [...ROOT_HOOK_TESTS] : []
}
