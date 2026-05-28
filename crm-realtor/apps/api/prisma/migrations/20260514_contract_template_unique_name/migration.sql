-- Make contract_templates.name unique
CREATE UNIQUE INDEX IF NOT EXISTS "contract_templates_name_key" ON "contract_templates"("name");
