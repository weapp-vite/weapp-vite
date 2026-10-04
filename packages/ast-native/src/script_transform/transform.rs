use super::{
    capabilities, component_manifest, component_options, component_seed, diagnostics, fragments,
    metadata, provenance,
    request::{Request, string},
    rewrite,
};
use napi::bindgen_prelude::Utf16String;
use napi_derive::napi;
use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use oxc_codegen::CodegenOptions;
use oxc_parser::Parser;
use oxc_semantic::SemanticBuilder;
use oxc_span::SourceType;
use serde_json::{Value, json};
use std::path::PathBuf;

#[napi(object)]
pub struct NativeScriptTransform {
    pub status: String,
    pub result_json: Option<String>,
    pub warnings: Vec<String>,
    pub unsupported_reason: Option<String>,
    pub diagnostics: Vec<super::NativeScriptDiagnostic>,
    pub omitted_undefined: Vec<String>,
}
impl NativeScriptTransform {
    fn empty(status: &str) -> Self {
        Self {
            status: status.to_owned(),
            result_json: None,
            warnings: Vec::new(),
            unsupported_reason: None,
            diagnostics: Vec::new(),
            omitted_undefined: Vec::new(),
        }
    }
    fn unsupported(reason: String) -> Self {
        let mut r = Self::empty("unsupported");
        r.unsupported_reason = Some(reason);
        r
    }
}

fn registration<'a>(
    program: &mut Program<'a>,
    component: Expression<'a>,
    index: usize,
    request: &Request,
    allocator: &'a Allocator,
) -> Result<Option<String>, String> {
    let skip = request.options["skipComponentTransform"] == true;
    let local = string(request.runtime(), "defaultOptionsIdentifier")?;
    let creator = string(&request.runtime()["apis"], "createWevuComponent")?;
    let source = if skip {
        "export default null;".to_owned()
    } else {
        format!("const {local}=null;{creator}({local});export default {local};")
    };
    let mut statements = fragments::statements(&source, allocator)?;
    if skip {
        let Statement::ExportDefaultDeclaration(export) = &mut statements[0] else {
            unreachable!()
        };
        export.declaration = ExportDefaultDeclarationKind::from(component);
    } else {
        let Statement::VariableDeclaration(declaration) = &mut statements[0] else {
            unreachable!()
        };
        declaration.declarations[0].init = Some(component);
    }
    for (offset, statement) in statements.into_iter().enumerate() {
        program.body.insert(index + offset, statement);
    }
    Ok((!skip).then_some(creator))
}

fn run(source: &str, request: Request) -> Result<NativeScriptTransform, String> {
    let allocator = Allocator::default();
    let origins = request
        .provenance
        .as_ref()
        .map(|contract| super::template_provenance::InlineOrigins::new(source, contract))
        .transpose()?;
    let mut parsed = Parser::new(&allocator, source, SourceType::ts()).parse();
    if !parsed.diagnostics.is_empty() || parsed.fatal_error {
        let mut result = NativeScriptTransform::empty("parse-error");
        result.diagnostics =
            diagnostics::diagnostics(source, &parsed.diagnostics).map_err(|e| e.to_string())?;
        return Ok(result);
    }
    let semantic = SemanticBuilder::new()
        .with_check_syntax_error(true)
        .build(&parsed.program);
    if !semantic.diagnostics.is_empty() {
        let mut result = NativeScriptTransform::empty("semantic-error");
        result.diagnostics =
            diagnostics::diagnostics(source, &semantic.diagnostics).map_err(|e| e.to_string())?;
        return Ok(result);
    }
    let scoping = semantic.semantic.into_scoping();
    let contract = request.rewrite_contract()?;
    let facts = capabilities::collect(&parsed.program, &request, &contract)?;
    let reserved = string(request.runtime(), "defaultOptionsIdentifier")?;
    if facts.bindings.contains(&reserved) {
        return Err("Default options binding collision".to_owned());
    }
    let mut prepared =
        rewrite::prepare_program(&mut parsed.program, &allocator, &contract, &scoping)?;
    if prepared.uses_slots {
        return Err("Implicit scoped slot host injection is deferred".to_owned());
    }
    let warnings;
    let imports;
    let style;
    let runtime;
    if let Some(object) = prepared.options_object_mut() {
        // 完整组件改写保留生产次序：defaults/style -> seed -> manifest -> class/inline -> function paths。
        style = Some(component_options::defaults_and_page(
            object,
            &request,
            &facts.flags,
            &allocator,
        )?);
        runtime = capabilities::resolve(object, &request)?;
        component_seed::inject(object, &allocator)?;
        component_manifest::inject(object, &request, &allocator)?;
        let plan = metadata::build(&request.options, &request.symbols()?)?;
        let applied = metadata::apply_to_component(plan, object, &allocator)?;
        if let Some(origins) = &origins {
            if !applied.inline_injected {
                return Err("Provenance inline assets were not injected".to_owned());
            }
            origins.apply(object, &request.symbols()?.inline_map_key, &request.options)?;
        }
        imports = applied.imports;
        warnings = applied.warnings;
        component_options::function_paths(object, &request, &allocator)?;
    } else {
        return Err("Only resolved object-literal default components are supported".to_owned());
    }
    if !matches!(
        prepared.expression.as_ref(),
        Some(Expression::ObjectExpression(_))
    ) {
        return Err(
            "Non-direct component expressions require provenance and capability analysis"
                .to_owned(),
        );
    }
    let creator = registration(
        &mut parsed.program,
        prepared.expression.take().unwrap(),
        prepared.default_export_index.unwrap(),
        &request,
        &allocator,
    )?;
    for import in imports {
        rewrite::ensure_runtime_import(
            &mut parsed.program,
            &allocator,
            &contract,
            &import.imported,
            &import.local,
        )?;
    }
    if let Some(creator) = creator {
        rewrite::ensure_runtime_import(
            &mut parsed.program,
            &allocator,
            &contract,
            &creator,
            &creator,
        )?;
    }
    if let Some(runtime) = &runtime {
        capabilities::install(
            &mut parsed.program,
            &request,
            &contract,
            runtime,
            facts.bindings,
            &allocator,
        )?;
    }
    let source_map = request.options["sourceMap"] != false;
    let source_mappings = source_map.then(|| rewrite::source_mapping::prepare(&mut parsed.program));
    let codegen_options = CodegenOptions {
        minify: request.options["minify"] == true,
        source_map_path: source_map.then(|| PathBuf::from("inline.ts")),
        ..CodegenOptions::default()
    };
    let generated = if let Some(origins) = &origins {
        origins.generate(&mut parsed.program, &allocator, codegen_options)?
    } else {
        provenance::generate(&mut parsed.program, &allocator, codegen_options)?
    };
    let map = if source_map {
        let map = source_mappings
            .as_ref()
            .unwrap()
            .repair_names(generated.map.ok_or("Missing generated map")?);
        serde_json::from_str(&map.to_json_string()).map_err(|e| e.to_string())?
    } else {
        Value::Null
    };
    let mut output = json!({"code":generated.code,"map":map,"transformed":true});
    if let Some(runtime) = runtime {
        output["runtimeCapabilities"] = runtime;
    }
    if request.options["skipComponentTransform"] != true
        && let Some(style) = style
    {
        output["componentStyleOptions"] = style;
    }
    let mut result = NativeScriptTransform::empty("ok");
    result.result_json = Some(output.to_string());
    result.warnings = warnings;
    result.omitted_undefined = request.omitted_undefined;
    Ok(result)
}

/// 仅实验入口：一次调用处理完整脚本阶段，失败不发布中间结果或告警，调用方整段回退。
#[napi(js_name = "transformScriptNative")]
pub fn transform_script_native(
    source: Utf16String,
    request: String,
) -> napi::Result<NativeScriptTransform> {
    let source = String::from_utf16(&source).map_err(|_| {
        napi::Error::from_reason("Experimental script input contains lone UTF-16 surrogates")
    })?;
    let result = Request::parse(&request).and_then(|request| run(&source, request));
    Ok(result.unwrap_or_else(NativeScriptTransform::unsupported))
}

#[cfg(test)]
#[path = "transform_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "template_provenance/transform_tests.rs"]
mod template_provenance_tests;

#[cfg(test)]
#[path = "template_provenance/fragment_tests.rs"]
mod template_fragment_tests;
