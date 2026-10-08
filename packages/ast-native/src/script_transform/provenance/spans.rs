use oxc_ast::ast::{Comment, Program};
use oxc_ast_visit::{Visit, VisitMut};
use oxc_span::{SPAN, Span};

struct Validate<'a> {
    source: &'a str,
    synthetic: bool,
    invalid: bool,
}

impl<'a> Visit<'a> for Validate<'_> {
    fn visit_span(&mut self, span: &Span) {
        self.synthetic |= *span == SPAN;
        self.invalid |= span.start > span.end
            || !self.source.is_char_boundary(span.start as usize)
            || !self.source.is_char_boundary(span.end as usize);
    }
}

/// 先检查完整坐标集，避免半途失败留下只平移了一半的树。
pub(super) fn validate(program: &Program<'_>) -> Result<bool, String> {
    let source = program.source_text;
    if source.len() > u32::MAX as usize - super::PREFIX.len() {
        return Err("Source is too large for provenance coordinates".to_owned());
    }
    let mut visitor = Validate {
        source,
        synthetic: false,
        invalid: false,
    };
    visitor.visit_program(program);
    for comment in &program.comments {
        visitor.visit_span(&comment.span);
        visitor.invalid |= !source.is_char_boundary(comment.attached_to as usize);
    }
    if visitor.invalid {
        return Err("Invalid original span in provenance preparation".to_owned());
    }
    Ok(visitor.synthetic)
}

struct Shift {
    restore: bool,
}

impl<'a> VisitMut<'a> for Shift {
    fn visit_span(&mut self, span: &mut Span) {
        if self.restore {
            if *span == Span::new(0, 1) {
                *span = SPAN;
            } else {
                span.start -= super::PREFIX.len() as u32;
                span.end -= super::PREFIX.len() as u32;
            }
        } else if *span == SPAN {
            *span = Span::new(0, 1);
        } else {
            span.start += super::PREFIX.len() as u32;
            span.end += super::PREFIX.len() as u32;
        }
    }
}

fn shift(program: &mut Program<'_>, restore: bool) {
    Shift { restore }.visit_program(program);
    // Oxc 的 AST visitor 不遍历 program.comments；span 和附着点必须一起平移。
    for comment in &mut program.comments {
        if restore {
            comment.span.start -= super::PREFIX.len() as u32;
            comment.span.end -= super::PREFIX.len() as u32;
            comment.attached_to -= super::PREFIX.len() as u32;
        } else {
            comment.span.start += super::PREFIX.len() as u32;
            comment.span.end += super::PREFIX.len() as u32;
            comment.attached_to += super::PREFIX.len() as u32;
        }
    }
}

pub(super) fn prepare(program: &mut Program<'_>) {
    shift(program, false);
}

pub(super) fn restore(program: &mut Program<'_>) {
    shift(program, true);
}

/// Linked/External 返回的注释也是输出的一部分，不能携带虚拟坐标。
pub(super) fn restore_legal_comment(comment: &mut Comment) -> Result<(), String> {
    let prefix = super::PREFIX.len() as u32;
    if comment.span.start < prefix || comment.span.end < prefix || comment.attached_to < prefix {
        return Err("Invalid legal comment provenance".to_owned());
    }
    comment.span.start -= prefix;
    comment.span.end -= prefix;
    comment.attached_to -= prefix;
    Ok(())
}
