use std::{borrow::Cow, collections::HashMap};

use oxc_ast::ast::*;
use oxc_ast_visit::{VisitMut, walk_mut};
use oxc_sourcemap::{SourceMap, Token};
use oxc_span::Span;

mod positions;
#[cfg(test)]
mod tests;

use positions::SourcePositions;

/// 只修复原源码中可证明的边界和改名；不猜测生成节点的来源，也不重新解析生成代码。
pub struct OriginalSourceMappings<'a> {
    source: &'a str,
    renamed: HashMap<(u32, u32), &'a str>,
}

impl<'a> OriginalSourceMappings<'a> {
    /// 同一源位置的语句映射可能先于标识符写入；补回改名前的名称，不改变任何坐标。
    pub fn repair_names(&self, map: SourceMap<'a>) -> SourceMap<'a> {
        if self.renamed.is_empty() {
            return map;
        }
        let mut parts = map.into_parts();
        for token in &mut parts.tokens {
            let Some(source_id) = token.get_source_id() else {
                continue;
            };
            // 完整脚本固定占据 source 0；同内容的模板来源也不能继承脚本改名记录。
            if source_id != 0
                || parts
                    .source_contents
                    .get(source_id as usize)
                    .and_then(Option::as_deref)
                    != Some(self.source)
            {
                continue;
            }
            let Some(original) = self
                .renamed
                .get(&(token.get_src_line(), token.get_src_col()))
            else {
                continue;
            };
            if token.get_name_id().is_some() {
                continue;
            }
            let name_id = parts
                .names
                .iter()
                .position(|name| name == original)
                .map(|id| id as u32)
                .unwrap_or_else(|| {
                    let id = parts.names.len() as u32;
                    parts.names.push(Cow::Borrowed(original));
                    id
                });
            *token = Token::new(
                token.get_dst_line(),
                token.get_dst_col(),
                token.get_src_line(),
                token.get_src_col(),
                Some(source_id),
                Some(name_id),
            );
        }
        // token name 改变后，编码分块中的 previous-name 缓存不再有效。
        parts.token_chunks = None;
        SourceMap::from_parts(parts)
    }
}

struct Prepare<'a> {
    source: &'a str,
    positions: SourcePositions<'a>,
    renamed: HashMap<(u32, u32), &'a str>,
}

impl Prepare<'_> {
    fn identifier(&mut self, span: Span, emitted: &str) {
        let Some(original) = self.source.get(span.start as usize..span.end as usize) else {
            return;
        };
        if original != emitted
            && oxc_syntax::identifier::is_identifier_name(original)
            && let Some(position) = self.positions.get(span.start)
        {
            self.renamed.insert(position, original);
        }
    }
}

impl<'a> VisitMut<'a> for Prepare<'a> {
    fn visit_binding_identifier(&mut self, node: &mut BindingIdentifier<'a>) {
        self.identifier(node.span, node.name.as_str());
    }

    fn visit_identifier_reference(&mut self, node: &mut IdentifierReference<'a>) {
        self.identifier(node.span, node.name.as_str());
    }

    fn visit_template_literal(&mut self, node: &mut TemplateLiteral<'a>) {
        // Oxc 在插值的 } 后打印后续 quasi，但会跳过零宽 span。空片段的真实来源
        // 是紧接 } 的边界：tail 的 ` 或下一插值的 ${。只扩展 end 到这个真实分隔符，
        // 使 codegen 发出 start 映射；raw/cooked、start 和打印内容均保持不变。
        // 此 preparation 必须在所有语义转换结束后、codegen 前调用，扩展不是语义范围。
        for quasi in node.quasis.iter_mut().skip(1) {
            let start = quasi.span.start as usize;
            if quasi.span.start == quasi.span.end
                && start > 0
                && quasi.value.raw.is_empty()
                && self.source.as_bytes().get(start - 1) == Some(&b'}')
            {
                let boundary = self.source.get(start..).is_some_and(|tail| {
                    if quasi.tail {
                        tail.starts_with('`')
                    } else {
                        tail.starts_with("${")
                    }
                });
                if boundary {
                    quasi.span.end += 1;
                }
            }
        }
        walk_mut::walk_template_literal(self, node);
    }
}

/// 在最终 AST 上准备 codegen 来源信息；只调用一次，不触发额外 parse 或代码生成。
pub fn prepare<'a>(program: &mut Program<'a>) -> OriginalSourceMappings<'a> {
    let source = program.source_text;
    let mut visitor = Prepare {
        source,
        positions: SourcePositions::new(source),
        renamed: HashMap::new(),
    };
    visitor.visit_program(program);
    OriginalSourceMappings {
        source,
        renamed: visitor.renamed,
    }
}
