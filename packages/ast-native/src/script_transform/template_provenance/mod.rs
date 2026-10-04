use oxc_ast::ast::ObjectExpression;
use serde_json::Value;

mod contract;
mod generate;
mod inline;
mod map;
#[cfg(test)]
mod multi_source_tests;
#[cfg(test)]
mod tests;

pub use contract::SourceContract;
pub struct InlineOrigins<'a> {
    contract: &'a SourceContract,
    origins: Vec<contract::CalleeOrigin>,
}
impl<'a> InlineOrigins<'a> {
    pub fn new(main: &str, contract: &'a SourceContract) -> Result<Self, String> {
        Ok(Self {
            origins: contract::validate(main, contract)?,
            contract,
        })
    }
    pub fn apply(
        &self,
        component: &mut ObjectExpression<'_>,
        key: &str,
        options: &Value,
    ) -> Result<(), String> {
        inline::apply(component, key, options, &self.origins)
    }
}
