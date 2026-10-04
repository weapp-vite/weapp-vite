use oxc_allocator::Allocator;
use oxc_ast::ast::Program;
use oxc_codegen::{Codegen, CodegenOptions, CodegenReturn};

mod map;
mod spans;
#[cfg(test)]
mod tests;

// 独立保留行只供 codegen 标记生成节点；不是可解析的 JS，也绝不进入最终 map 或代码。
const PREFIX: &str = "\0\n";

struct VirtualSource<'p, 'a> {
    program: &'p mut Program<'a>,
    original: &'a str,
}

impl Drop for VirtualSource<'_, '_> {
    fn drop(&mut self) {
        spans::restore(self.program);
        self.program.source_text = self.original;
    }
}

/// 使用 Oxc 自己的打印位置标记生成节点；不增加 parse，退出时恢复全部 AST 来源信息。
pub fn generate<'a>(
    program: &mut Program<'a>,
    allocator: &'a Allocator,
    options: CodegenOptions,
) -> Result<CodegenReturn<'a>, String> {
    if options.source_map_path.is_none() || !spans::validate(program)? {
        return Ok(Codegen::new().with_options(options).build(program));
    }
    let original = program.source_text;
    let virtual_source = allocator.alloc_str(&format!("{PREFIX}{original}"));
    spans::prepare(program);
    program.source_text = virtual_source;
    let guard = VirtualSource { program, original };
    let mut generated = Codegen::new().with_options(options).build(guard.program);
    // finalize 可能拒绝异常 map；先恢复 AST，错误路径也不遗留虚拟坐标。
    drop(guard);
    for comment in &mut generated.legal_comments {
        spans::restore_legal_comment(comment)?;
    }
    let map = generated
        .map
        .take()
        .ok_or("Missing provenance source map")?;
    generated.map = Some(map::finalize(map, original, virtual_source)?);
    Ok(generated)
}
