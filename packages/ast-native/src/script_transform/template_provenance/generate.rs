use super::{
    InlineOrigins,
    map::{self, Region},
};
use oxc_allocator::Allocator;
use oxc_ast::ast::Program;
use oxc_ast_visit::{Visit, VisitMut};
use oxc_codegen::{Codegen, CodegenOptions, CodegenReturn};
use oxc_span::{SPAN, Span};
use std::collections::HashMap;

struct Restore<'p, 'a> {
    program: &'p mut Program<'a>,
    source: &'a str,
    spans: Vec<Span>,
    comments: Vec<(Span, u32)>,
}
struct Replace<'s> {
    spans: std::slice::Iter<'s, Span>,
}
impl<'a> VisitMut<'a> for Replace<'_> {
    fn visit_span(&mut self, span: &mut Span) {
        *span = *self.spans.next().expect("unchanged AST span inventory");
    }
}
impl Drop for Restore<'_, '_> {
    fn drop(&mut self) {
        Replace {
            spans: self.spans.iter(),
        }
        .visit_program(self.program);
        for (comment, (span, attached_to)) in self.program.comments.iter_mut().zip(&self.comments) {
            comment.span = *span;
            comment.attached_to = *attached_to;
        }
        self.program.source_text = self.source;
    }
}
#[derive(Default)]
struct Collect {
    spans: Vec<Span>,
}
impl<'a> Visit<'a> for Collect {
    fn visit_span(&mut self, span: &Span) {
        self.spans.push(*span);
    }
}
fn original_span(source: &str, span: Span) -> bool {
    span.start <= span.end
        && source.is_char_boundary(span.start as usize)
        && source.is_char_boundary(span.end as usize)
}

impl InlineOrigins<'_> {
    /// 外部完整源码排在主脚本之前，保持原脚本的 EOF 仍是打印器看到的 EOF。
    pub fn generate<'a>(
        &self,
        program: &mut Program<'a>,
        allocator: &'a Allocator,
        options: CodegenOptions,
    ) -> Result<CodegenReturn<'a>, String> {
        let main = program.source_text;
        let mut arena = "\0\n".to_owned();
        let mut starts = Vec::new();
        let mut regions = Vec::new();
        let mut line = 1;
        for (index, source) in self.contract.sources.iter().enumerate() {
            starts.push(arena.len() as u32);
            let lengths = map::line_lengths(&source.content);
            regions.push(Region {
                source_id: index as u32 + 1,
                line,
                lengths: lengths.clone(),
            });
            line += lengths.len() as u32 - 1 + if source.content.ends_with('\r') { 1 } else { 2 };
            arena.push_str(&source.content);
            arena.push_str("\n\0\n");
        }
        let main_start = arena.len() as u32;
        regions.push(Region {
            source_id: 0,
            line,
            lengths: map::line_lengths(main),
        });
        arena.push_str(main);
        let arena = allocator.alloc_str(&arena);
        let external: HashMap<_, _> = self
            .origins
            .iter()
            .map(|origin| {
                (
                    (origin.handle.start, origin.handle.end),
                    Span::new(
                        starts[origin.source_index] + origin.original.start,
                        starts[origin.source_index] + origin.original.end,
                    ),
                )
            })
            .collect();
        let mut collected = Collect::default();
        collected.visit_program(program);
        let shifted = collected
            .spans
            .iter()
            .map(|span| {
                if *span == SPAN {
                    return Ok(Span::new(0, 1));
                }
                if let Some(mapped) = external.get(&(span.start, span.end)) {
                    return Ok(*mapped);
                }
                if !original_span(main, *span) {
                    return Err("Unknown source span in template provenance".to_owned());
                }
                Ok(Span::new(span.start + main_start, span.end + main_start))
            })
            .collect::<Result<Vec<_>, _>>()?;
        let comments = program
            .comments
            .iter()
            .map(|comment| {
                if !original_span(main, comment.span)
                    || !main.is_char_boundary(comment.attached_to as usize)
                {
                    return Err("Invalid main-source comment provenance".to_owned());
                }
                Ok((comment.span, comment.attached_to))
            })
            .collect::<Result<Vec<_>, _>>()?;
        let guard = Restore {
            program,
            source: main,
            spans: collected.spans,
            comments,
        };
        Replace {
            spans: shifted.iter(),
        }
        .visit_program(guard.program);
        for comment in &mut guard.program.comments {
            comment.span.start += main_start;
            comment.span.end += main_start;
            comment.attached_to += main_start;
        }
        guard.program.source_text = arena;
        let mut generated = Codegen::new().with_options(options).build(guard.program);
        drop(guard);
        for comment in &mut generated.legal_comments {
            if comment.span.start < main_start
                || comment.span.end < main_start
                || comment.attached_to < main_start
            {
                return Err("Invalid returned main-source comment provenance".to_owned());
            }
            comment.span.start -= main_start;
            comment.span.end -= main_start;
            comment.attached_to -= main_start;
        }
        if let Some(map) = generated.map.take() {
            generated.map = Some(map::finish(
                map,
                arena,
                &regions,
                main,
                &self.contract.sources,
            )?);
        }
        Ok(generated)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use oxc_parser::Parser;
    use oxc_span::SourceType;

    #[test]
    fn restores_main_origin_and_comment_ownership_when_codegen_scope_unwinds() {
        let allocator = Allocator::default();
        let source = "// retained\nconst value=1;";
        let mut program = Parser::new(&allocator, source, SourceType::mjs())
            .parse()
            .program;
        let mut before = Collect::default();
        before.visit_program(&program);
        let comments: Vec<_> = program
            .comments
            .iter()
            .map(|comment| (comment.span, comment.attached_to))
            .collect();
        let error = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let guard = Restore {
                program: &mut program,
                source,
                spans: before.spans.clone(),
                comments: comments.clone(),
            };
            let synthetic = vec![Span::new(0, 1); before.spans.len()];
            Replace {
                spans: synthetic.iter(),
            }
            .visit_program(guard.program);
            guard.program.source_text = "\0\n";
            guard.program.comments[0].span = Span::new(0, 1);
            guard.program.comments[0].attached_to = 1;
            panic!("simulated codegen unwind");
        }));
        assert!(error.is_err());
        let mut after = Collect::default();
        after.visit_program(&program);
        assert_eq!(after.spans, before.spans);
        assert_eq!(program.source_text, source);
        assert_eq!(
            program
                .comments
                .iter()
                .map(|comment| (comment.span, comment.attached_to))
                .collect::<Vec<_>>(),
            comments
        );
    }
}
