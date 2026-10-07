export type Impact = 'minor' | 'moderate' | 'serious' | 'critical';
export type Category = 'rule_fixable' | 'needs_judgment' | 'layout';
export type MappingConfidence = 'high' | 'medium' | 'low' | 'none';
export type Status = 'open' | 'fixed_by_rule' | 'fixed_by_llm' | 'unfixed' | 'rejected';

export interface Violation {
  /** Stable hash of rule, route, and selector. */
  id: string;
  ruleId: string;
  impact: Impact | null;
  wcagTags: string[];
  route: string;
  selector: string;
  html: string;
  /** null until the classify stage runs. */
  category: Category | null;
  /** null until the map stage runs. */
  sourceFile: string | null;
  sourceLine: number | null;
  mappingConfidence: MappingConfidence | null;
  status: Status;
  notes: string[];
}

export interface ViolationsFile {
  schemaVersion: 1;
  generatedAt: string;
  target: { path: string; commit: string | null };
  baseUrl: string;
  configHash: string;
  axeVersion: string | null;
  routes: string[];
  violations: Violation[];
}
