use oxc_sourcemap::{SourceMap, Token};
use std::borrow::Cow;

pub struct Region {
    pub source_id: u32,
    pub line: u32,
    pub lengths: Vec<u32>,
}
pub fn line_lengths(source: &str) -> Vec<u32> {
    let mut lines = vec![0];
    let mut after_cr = false;
    for character in source.chars() {
        match character {
            '\n' if after_cr => {}
            '\r' | '\n' | '\u{2028}' | '\u{2029}' => lines.push(0),
            _ => *lines.last_mut().unwrap() += character.len_utf16() as u32,
        }
        after_cr = character == '\r';
    }
    lines
}
fn append(tokens: &mut Vec<Token>, token: Token) -> Result<(), String> {
    if let Some(previous) = tokens.last_mut() {
        let before = (previous.get_dst_line(), previous.get_dst_col());
        let next = (token.get_dst_line(), token.get_dst_col());
        if before > next {
            return Err("Template mappings are not in printing order".to_owned());
        }
        if before == next {
            *previous = token;
            return Ok(());
        }
    }
    tokens.push(token);
    Ok(())
}

pub fn finish<'a>(
    map: SourceMap<'a>,
    arena: &str,
    regions: &[Region],
    main: &str,
    sources: &[super::contract::Source],
) -> Result<SourceMap<'a>, String> {
    let mut parts = map.into_parts();
    if parts.sources.len() != 1
        || parts.source_contents.len() != 1
        || parts.source_contents[0].as_deref() != Some(arena)
    {
        return Err("Template provenance arena identity differs".to_owned());
    }
    let mut tokens = Vec::with_capacity(parts.tokens.len());
    for token in &parts.tokens {
        if token.get_source_id() != Some(0)
            || token
                .get_name_id()
                .is_some_and(|id| id as usize >= parts.names.len())
        {
            return Err("Invalid template provenance source/name id".to_owned());
        }
        let (source, line, column, name) = if token.get_src_line() == 0 {
            if token.get_src_col() > 1 {
                return Err("Invalid template synthetic coordinate".to_owned());
            }
            (None, 0, 0, None)
        } else {
            let region = regions
                .iter()
                .rev()
                .find(|region| region.line <= token.get_src_line())
                .ok_or("Unknown template provenance source region")?;
            let line = token.get_src_line() - region.line;
            if region
                .lengths
                .get(line as usize)
                .is_none_or(|length| token.get_src_col() > *length)
            {
                return Err("Template provenance coordinate outside complete source".to_owned());
            }
            (
                Some(region.source_id),
                line,
                token.get_src_col(),
                token.get_name_id(),
            )
        };
        append(
            &mut tokens,
            Token::new(
                token.get_dst_line(),
                token.get_dst_col(),
                line,
                column,
                source,
                name,
            ),
        )?;
    }
    let mut names = Vec::new();
    let mut name_ids = vec![None; parts.names.len()];
    for token in &mut tokens {
        let name = token.get_name_id().map(|id| {
            *name_ids[id as usize].get_or_insert_with(|| {
                let next = names.len() as u32;
                names.push(parts.names[id as usize].clone());
                next
            })
        });
        *token = Token::new(
            token.get_dst_line(),
            token.get_dst_col(),
            token.get_src_line(),
            token.get_src_col(),
            token.get_source_id(),
            name,
        );
    }
    parts.tokens = tokens.into_boxed_slice();
    parts.names = names;
    parts.source_contents = vec![Some(Cow::Owned(main.to_owned()))];
    for source in sources {
        parts
            .sources
            .push(Cow::Owned(source.filename.replace('\\', "/")));
        parts
            .source_contents
            .push(Some(Cow::Owned(source.content.clone())));
    }
    parts.token_chunks = None;
    Ok(SourceMap::from_parts(parts))
}
