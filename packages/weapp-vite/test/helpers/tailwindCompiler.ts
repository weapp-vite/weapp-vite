import type { CompilerGenerateResult, CompilerSnapshot } from 'weapp-tailwindcss/core'

/** 为只验证宿主交付的测试提供完整 core 生成契约，来源根保持默认自动扫描语义。 */
export function createTailwindGenerateResult(css: string, snapshot: CompilerSnapshot): CompilerGenerateResult {
  return {
    cache: { source: false, engine: false, output: false },
    classSet: snapshot.classSet,
    css,
    rawCss: css,
    dependencies: snapshot.dependencies,
    rawCandidates: new Set(snapshot.classSet),
    revision: snapshot.roots[0]?.revision ?? 1,
    root: null,
    snapshot,
    sources: snapshot.sources,
    target: snapshot.target,
  }
}
