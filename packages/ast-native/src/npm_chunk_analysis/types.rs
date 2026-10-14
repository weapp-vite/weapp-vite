use napi_derive::napi;

#[napi(object)]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NativeNpmRequireFact {
    pub start: u32,
    pub end: u32,
    pub importee: String,
}

#[napi(object)]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NativeNpmPlatformApiFact {
    pub start: u32,
    pub end: u32,
}

#[napi(object)]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NativeNpmLocalRootFact {
    pub kind: String,
    pub require_index: Option<u32>,
    pub binding_name: Option<String>,
    pub reference_name: Option<String>,
    pub importee: Option<String>,
    pub second_argument_start: Option<u32>,
    pub second_argument_end: Option<u32>,
}

#[napi(object)]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NativeNpmChunkAnalysis {
    pub requires: Vec<NativeNpmRequireFact>,
    pub platform_api_ranges: Vec<NativeNpmPlatformApiFact>,
    pub local_root_facts: Vec<NativeNpmLocalRootFact>,
}
