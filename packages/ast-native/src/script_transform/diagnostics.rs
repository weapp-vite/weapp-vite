use napi_derive::napi;
use oxc_diagnostics::OxcDiagnostic;

#[derive(Debug)]
#[napi(object)]
pub struct NativeScriptDiagnosticLabel {
    pub start: u32,
    pub end: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct NativeScriptDiagnostic {
    pub message: String,
    pub labels: Vec<NativeScriptDiagnosticLabel>,
}

fn utf16_offset(code: &str, byte: u32) -> napi::Result<u32> {
    code.get(..byte as usize)
        .map(|prefix| prefix.encode_utf16().count() as u32)
        .ok_or_else(|| napi::Error::from_reason("Experimental script diagnostic has an invalid source offset"))
}

pub(super) fn diagnostics(
    code: &str,
    diagnostics: &[OxcDiagnostic],
) -> napi::Result<Vec<NativeScriptDiagnostic>> {
    diagnostics.iter().map(|diagnostic| {
        let labels = diagnostic.labels.iter().map(|label| {
            let span = label.span();
            Ok(NativeScriptDiagnosticLabel {
                start: utf16_offset(code, span.start)?,
                end: utf16_offset(code, span.end)?,
            })
        }).collect::<napi::Result<Vec<_>>>()?;
        Ok(NativeScriptDiagnostic { message: diagnostic.message.to_string(), labels })
    }).collect()
}
