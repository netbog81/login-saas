-- Create template_assignments table manually
CREATE TABLE IF NOT EXISTS "template_assignments" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "operatorId" uuid NOT NULL,
  "patternId" uuid NOT NULL,
  "patternStartDate" date NOT NULL,
  "validFrom" date NOT NULL,
  "validUntil" date,
  "version" integer NOT NULL DEFAULT 1,
  "isCurrent" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "FK_template_assignments_operator" FOREIGN KEY ("operatorId")
    REFERENCES "operators"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_template_assignments_pattern" FOREIGN KEY ("patternId")
    REFERENCES "template_patterns"("id") ON DELETE RESTRICT
);

-- Create indexes for template_assignments
CREATE INDEX IF NOT EXISTS "IDX_template_assignments_operator_current"
  ON "template_assignments" ("operatorId", "isCurrent");

CREATE INDEX IF NOT EXISTS "IDX_template_assignments_validity"
  ON "template_assignments" ("validFrom", "validUntil");
