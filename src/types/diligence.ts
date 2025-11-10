/**
 * Core type definitions for diligence operations
 */

export type DiligenceScope = 'full' | 'financial' | 'commercial' | 'technical';
export type DiligenceDepth = 'standard' | 'deep' | 'exhaustive';
export type DiligencePriority = 'normal' | 'high' | 'critical';
export type DiligenceStatus = 'initiated' | 'in_progress' | 'completed' | 'failed';

export interface DiligenceConfig {
  companyName: string;
  companyDomain: string;
  scope: DiligenceScope;
  depth: DiligenceDepth;
  priority: DiligencePriority;
  webhookUrl?: string;
}

export interface DiligenceRequest {
  companyName: string;
  companyDomain: string;
  scope: DiligenceScope;
  depth: DiligenceDepth;
  priority: DiligencePriority;
  webhookUrl?: string;
}

export interface DiligenceStatusInfo {
  diligenceId: string;
  status: DiligenceStatus;
  progress: number;
  currentStage: string;
  agentsActive: string[];
  estimatedCompletion?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResearchPlan {
  diligenceId: string;
  company: string;
  scope: DiligenceScope;
  depth: DiligenceDepth;
  stages: ResearchStage[];
  estimatedDuration: number;
}

export interface ResearchStage {
  name: string;
  description: string;
  agents: string[];
  dependencies: string[];
  estimatedDuration: number;
  priority: number;
}

export interface ResearchGap {
  area: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction: string;
}

export interface ValidationReport {
  diligenceId: string;
  validatedFindings: AgentResult[];
  conflicts: DataConflict[];
  gaps: ResearchGap[];
  confidenceScore: number;
}

export interface DataConflict {
  field: string;
  sources: string[];
  values: unknown[];
  resolution?: unknown;
}

export interface AgentResult {
  agentName: string;
  timestamp: Date;
  findings: unknown;
  sources: SourceReference[];
  confidence: number;
  redFlags: RedFlag[];
}

export interface SourceReference {
  source: string;
  url?: string;
  retrievedAt: Date;
  reliability: number;
}

export interface RedFlag {
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: string[];
  impact: string;
  recommendation: string;
}

export interface FinalReport {
  diligenceId: string;
  company: CompanyOverview;
  executiveSummary: ExecutiveSummary;
  financialAnalysis: FinancialAnalysis;
  marketAnalysis: MarketAnalysis;
  competitiveAnalysis: CompetitiveAnalysis;
  riskAssessment: RiskAssessment;
  recommendations: Recommendation[];
  generatedAt: Date;
}

export interface CompanyOverview {
  name: string;
  domain: string;
  industry: string;
  founded?: number;
  headquarters?: string;
  employees?: number;
  description: string;
}

export interface ExecutiveSummary {
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'pass';
  keyFindings: string[];
  criticalRisks: RedFlag[];
  investmentThesis: string;
}

export interface FinancialAnalysis {
  revenue: RevenueMetrics;
  profitability: ProfitabilityMetrics;
  valuation: ValuationMetrics;
  unitEconomics?: UnitEconomics;
}

// Note: Detailed versions of these types are exported from agents.ts
// These are internal simplified versions for diligence platform use
interface RevenueMetrics {
  currentARR?: number;
  growthRate: number;
  revenueQuality: number;
  historicalRevenue: HistoricalDataPoint[];
}

interface ProfitabilityMetrics {
  grossMargin: number;
  ebitdaMargin: number;
  fcfConversion: number;
}

interface ValuationMetrics {
  enterpriseValue?: number;
  evRevenueMultiple?: number;
  dcfValuation?: number;
  comparablesRange?: [number, number];
}

interface UnitEconomics {
  cac: number;
  ltv: number;
  ltvCacRatio: number;
  paybackPeriod: number;
  contributionMargin: number;
}

interface HistoricalDataPoint {
  period: string;
  value: number;
}

interface MarketAnalysis {
  tam: number;
  sam: number;
  som: number;
  marketGrowthRate: number;
  industryStructure: string;
  regulatoryLandscape: string;
}

interface CompetitiveAnalysis {
  competitors: Competitor[];
  marketShare?: number;
  competitivePosition: string;
  moatAssessment: MoatAssessment;
}

interface Competitor {
  name: string;
  marketShare?: number;
  strengths: string[];
  weaknesses: string[];
}

interface MoatAssessment {
  networkEffects: number;
  switchingCosts: number;
  brandValue: number;
  overallScore: number;
}

export interface RiskAssessment {
  executionRisk: RiskScore;
  marketRisk: RiskScore;
  technologyRisk: RiskScore;
  financialRisk: RiskScore;
  regulatoryRisk: RiskScore;
  overallRiskScore: number;
}

interface RiskScore {
  score: number;
  category: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigation?: string;
}

export interface Recommendation {
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
  rationale: string;
  expectedImpact: string;
}
