use std::borrow::Cow;

use oxc_sourcemap::{SourceMap, Token};

fn line_lengths(source: &str) -> Vec<u32> {
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

fn append_printed_owner(tokens: &mut Vec<Token>, token: Token) -> Result<(), String> {
    if let Some(previous) = tokens.last_mut() {
        let before = (previous.get_dst_line(), previous.get_dst_col());
        let next = (token.get_dst_line(), token.get_dst_col());
        if before > next {
            return Err("Provenance mappings are not in printing order".to_owned());
        }
        if before == next {
            // Oxc 先标记父语句，再标记即将打印的子 token。相同生成坐标只保留
            // 最后的所有者，避免消费者对重复列选择 first/last 产生不同结果。
            *previous = token;
            return Ok(());
        }
    }
    tokens.push(token);
    Ok(())
}

/// 只有来源身份及坐标都可验证时才发布 map；保留行变为显式 unmapped segment。
pub(super) fn finalize<'a>(
    map: SourceMap<'a>,
    original: &'a str,
    virtual_source: &str,
) -> Result<SourceMap<'a>, String> {
    let mut parts = map.into_parts();
    if parts.sources.len() != 1
        || parts.source_contents.len() != 1
        || parts.source_contents[0].as_deref() != Some(virtual_source)
        || virtual_source.strip_prefix(super::PREFIX) != Some(original)
    {
        return Err("Provenance source identity differs from codegen input".to_owned());
    }
    let line_lengths = line_lengths(original);
    let mut tokens = Vec::with_capacity(parts.tokens.len());
    for token in &parts.tokens {
        if token.get_source_id() != Some(0) {
            return Err("Unexpected source id in provenance map".to_owned());
        }
        if token
            .get_name_id()
            .is_some_and(|id| id as usize >= parts.names.len())
        {
            return Err("Invalid provenance name id".to_owned());
        }
        if token.get_src_line() == 0 {
            if token.get_src_col() > 1 {
                return Err("Invalid synthetic provenance coordinate".to_owned());
            }
            append_printed_owner(
                &mut tokens,
                Token::new(token.get_dst_line(), token.get_dst_col(), 0, 0, None, None),
            )?;
            continue;
        }
        let line = token.get_src_line() - 1;
        if line_lengths
            .get(line as usize)
            .is_none_or(|length| token.get_src_col() > *length)
        {
            return Err("Original provenance coordinate is outside source content".to_owned());
        }
        append_printed_owner(
            &mut tokens,
            Token::new(
                token.get_dst_line(),
                token.get_dst_col(),
                line,
                token.get_src_col(),
                Some(0),
                token.get_name_id(),
            ),
        )?;
    }
    // 先消除重叠，再重建 names，已被最终所有者替换的名称不进入输出。
    let mut names = Vec::new();
    let mut name_ids = vec![None; parts.names.len()];
    for token in &mut tokens {
        let name = match token.get_name_id() {
            Some(id) => {
                let assigned = name_ids
                    .get_mut(id as usize)
                    .ok_or("Invalid provenance name id")?;
                Some(*assigned.get_or_insert_with(|| {
                    let new_id = names.len() as u32;
                    names.push(parts.names[id as usize].clone());
                    new_id
                }))
            }
            None => None,
        };
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
    parts.source_contents[0] = Some(Cow::Borrowed(original));
    parts.token_chunks = None;
    Ok(SourceMap::from_parts(parts))
}
