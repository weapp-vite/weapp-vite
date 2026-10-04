pub(super) struct SourcePositions<'a> {
    source: &'a str,
    lines: Vec<usize>,
}

impl<'a> SourcePositions<'a> {
    pub fn new(source: &'a str) -> Self {
        let mut lines = vec![0];
        let mut after_cr = false;
        for (offset, character) in source.char_indices() {
            match character {
                '\n' if after_cr => *lines.last_mut().unwrap() = offset + 1,
                '\r' | '\n' | '\u{2028}' | '\u{2029}' => lines.push(offset + character.len_utf8()),
                _ => {}
            }
            after_cr = character == '\r';
        }
        Self { source, lines }
    }

    /// sourcemap 的列使用 UTF-16，行从零开始；CRLF 只算一个换行。
    pub fn get(&self, offset: u32) -> Option<(u32, u32)> {
        let offset = offset as usize;
        let line = self
            .lines
            .partition_point(|start| *start <= offset)
            .checked_sub(1)?;
        let prefix = self.source.get(self.lines[line]..offset)?;
        Some((line as u32, prefix.encode_utf16().count() as u32))
    }
}
