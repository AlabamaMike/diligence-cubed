/**
 * Type definitions for agent system
 */

export type AgentType =
  | 'orchestrator'
  | 'financial'
  | 'market'
  | 'competitive'
  | 'product_tech'
  | 'customer_revenue'
  | 'news_sentiment'
  | 'risk'
  | 'synthesis';

export type AgentStatus = 'idle' | 'active' | 'paused' | 'completed' | 'failed';

export interface Agent {
  id: string;
  type: AgentType;
  name: string;
  status: AgentStatus;
  capabilities: string[];
  mcpServers: string[];
}

export interface AgentTask {
  taskId: string;
  agentType: AgentType;
  description: string;
  priority: number;
  dependencies: string[];
  parameters: Record<string, unknown>;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: unknown;
  error?: Error;
  startedAt?: Date;
  completedAt?: Date;
}

export interface AgentContext {
  diligenceId: string;
  companyName: string;
  companyDomain: string;
  scope: string;
  depth: string;
  sharedKnowledge: Map<string, unknown>;
}

export interface AgentResponse<T = unknown> {
  agentType: AgentType;
  taskId: string;
  success: boolean;
  data?: T;
  error?: string;
  confidence: number;
  sources: string[];
  timestamp: Date;
}

export interface OrchestratorDecision {
  action: 'delegate' | 'validate' | 'escalate' | 'synthesize';
  targetAgents: AgentType[];
  reason: string;
  priority: number;
}

export interface AgentMetrics {
  agentId: string;
  tasksCompleted: number;
  averageExecutionTime: number;
  successRate: number;
  lastActiveAt: Date;
}

// Base Agent Execution Result Types (renamed to avoid conflict with diligence.ts AgentResult)
export interface AgentExecutionResult {
  agentId: string;
  agentType: string;
  status: 'success' | 'failed';
  data: any;
  metadata: {
    executionTime: number;
    dataPoints: number;
    sources: string[];
    confidence: number;
  };
  warnings: string[];
  errors: string[];
  timestamp: Date;
}

export class AgentError extends Error {
  constructor(
    message: string,
    public agentType: string,
    public originalError?: Error,
    public retryable: boolean = true
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

// Priority and Severity Types
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type Severity = 'info' | 'warning' | 'critical';

// Detailed internal types used by agents (distinct from platform-level types in diligence.ts)
export interface DetailedDiligenceScope {
  includeFinancial: boolean;
  includeMarket: boolean;
  includeCompetitive: boolean;
  includeTechnology: boolean;
  includeCustomer: boolean;
  includeNews: boolean;
  includeRisk: boolean;
  depth: 'standard' | 'deep' | 'exhaustive';
}

export interface Task {
  id: string;
  agentType: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: Priority;
  dependencies: string[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: AgentExecutionResult;
}

export interface DetailedResearchPlan {
  id: string;
  company: string;
  scope: DetailedDiligenceScope;
  tasks: Task[];
  dependencies: Map<string, string[]>;
  estimatedDuration: number;
  createdAt: Date;
}

export interface CrossValidation {
  fact: string;
  sources: string[];
  agreement: number;
  confidence: number;
}

export interface Inconsistency {
  description: string;
  conflictingSources: string[];
  severity: Severity;
  needsResolution: boolean;
}

export interface DetailedValidationReport {
  overallConfidence: number;
  crossValidatedFacts: CrossValidation[];
  inconsistencies: Inconsistency[];
  verifiedDataPoints: number;
  totalDataPoints: number;
  timestamp: Date;
}

// Financial Analysis Types
export interface FinancialAnalysisInput {
  companyName: string;
  ticker?: string;
  fiscalYearEnd?: string;
}

export interface FinancialSummary {
  revenueMetrics: RevenueMetrics;
  profitability: ProfitabilityMetrics;
  cashFlow: CashFlowMetrics;
  balanceSheet: BalanceSheetMetrics;
  valuation: ValuationAnalysis;
  unitEconomics?: UnitEconomics;
  scenarios: ScenarioAnalysis;
  redFlags: string[];
  opportunities: string[];
  dataQuality: number;
}

export interface RevenueMetrics {
  currentRevenue: number;
  arr?: number;
  growthRate: number;
  growthRateYoY: number[];
  revenueQuality: number;
  recurring: number;
  oneTime: number;
}

export interface ProfitabilityMetrics {
  grossMargin: number;
  ebitdaMargin: number;
  netMargin: number;
  marginTrends: number[];
}

export interface CashFlowMetrics {
  operatingCashFlow: number;
  freeCashFlow: number;
  fcfConversion: number;
  burnRate: number;
  runway?: number;
}

export interface BalanceSheetMetrics {
  totalAssets: number;
  totalLiabilities: number;
  equity: number;
  debt: number;
  cash: number;
  currentRatio: number;
  quickRatio: number;
  debtToEquity: number;
}

export interface ValuationAnalysis {
  enterpriseValue: number;
  evRevenue: number;
  evEbitda: number;
  dcfValuation: number;
  comparablesRange: {
    min: number;
    max: number;
    median: number;
  };
  impliedValuation: number;
}

export interface UnitEconomics {
  cac: number;
  ltv: number;
  ltvCacRatio: number;
  paybackPeriod: number;
  contributionMargin: number;
}

export interface ScenarioAnalysis {
  base: Scenario;
  bull: Scenario;
  bear: Scenario;
}

export interface Scenario {
  name: string;
  probability: number;
  revenue: number;
  ebitda: number;
  valuation: number;
  assumptions: string[];
}

// Market Analysis Types
export interface MarketAnalysisInput {
  companyName: string;
  industry: string;
  geography?: string[];
}

export interface MarketAnalysis {
  marketSizing: MarketSizing;
  growthDrivers: GrowthDriver[];
  industryStructure: IndustryStructure;
  regulatoryLandscape: RegulatoryAnalysis;
  economicSensitivity: EconomicSensitivity;
  trends: MarketTrend[];
  dataQuality: number;
}

export interface MarketSizing {
  tam: number;
  sam: number;
  som: number;
  methodology: string;
  growthRate: number;
  projections: Array<{ year: number; size: number }>;
  confidence: number;
}

export interface GrowthDriver {
  name: string;
  impact: 'low' | 'medium' | 'high';
  description: string;
  timeline: string;
}

export interface IndustryStructure {
  concentration: number;
  topPlayers: Array<{ name: string; marketShare: number }>;
  barriersToEntry: string[];
  supplierPower: number;
  buyerPower: number;
  threatOfSubstitutes: number;
}

export interface RegulatoryAnalysis {
  currentRegulations: string[];
  upcomingChanges: string[];
  complianceRequirements: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface EconomicSensitivity {
  gdpCorrelation: number;
  cyclicality: 'low' | 'medium' | 'high';
  recessionResilience: number;
}

export interface MarketTrend {
  name: string;
  direction: 'positive' | 'negative' | 'neutral';
  strength: number;
  impact: string;
}

// Competitive Analysis Types
export interface CompetitiveAnalysisInput {
  companyName: string;
  industry?: string;
  competitors?: string[];
}

export interface CompetitiveAnalysis {
  competitiveMap: CompetitorProfile[];
  positioning: PositioningAnalysis;
  marketShare: MarketShareAnalysis;
  moatAssessment: MoatAnalysis;
  disruptionRisk: DisruptionAnalysis;
  dataQuality: number;
}

export interface CompetitorProfile {
  name: string;
  type: 'direct' | 'indirect' | 'potential';
  marketShare?: number;
  strengths: string[];
  weaknesses: string[];
  recentMoves: string[];
  funding?: number;
  employee_count?: number;
}

export interface PositioningAnalysis {
  differentiators: string[];
  pricingStrategy: string;
  targetMarket: string;
  goToMarket: string;
  competitiveAdvantages: string[];
  vulnerabilities: string[];
}

export interface MarketShareAnalysis {
  currentShare: number;
  shareGrowth: number;
  winRate: number;
  churnToCompetitors: Array<{ competitor: string; rate: number }>;
}

export interface MoatAnalysis {
  overallStrength: number;
  networkEffects: number;
  switchingCosts: number;
  brandValue: number;
  proprietaryTech: number;
  scaleAdvantages: number;
  assessment: string;
}

export interface DisruptionAnalysis {
  riskLevel: 'low' | 'medium' | 'high';
  emergingTechnologies: string[];
  newEntrants: string[];
  businessModelThreats: string[];
}

// Customer & Revenue Analysis Types
export interface CustomerAnalysisInput {
  companyName: string;
  customerSegments?: string[];
}

export interface CustomerAnalysis {
  concentration: CustomerConcentration;
  retention: RetentionAnalysis;
  salesEfficiency: SalesEfficiency;
  expansion: ExpansionMetrics;
  satisfaction: CustomerSatisfaction;
  revenueQuality: RevenueQualityScore;
  dataQuality: number;
}

export interface CustomerConcentration {
  top5Percentage: number;
  top10Percentage: number;
  herfindahlIndex: number;
  riskLevel: 'low' | 'medium' | 'high';
  keyAccounts: Array<{ percentage: number; name?: string }>;
}

export interface RetentionAnalysis {
  grossRetention: number;
  netRetention: number;
  churnRate: number;
  cohortAnalysis: Array<{ cohort: string; retention: number }>;
  churnDrivers: string[];
}

export interface SalesEfficiency {
  cac: number;
  cacTrend: number[];
  salesCycle: number;
  winRate: number;
  quotaAttainment: number;
}

export interface ExpansionMetrics {
  upsellRate: number;
  crossSellRate: number;
  expansionRevenue: number;
  landAndExpandSuccess: number;
}

export interface CustomerSatisfaction {
  nps: number;
  npsTrend: number[];
  reviewScore: number;
  reviewCount: number;
  supportMetrics: {
    responseTime: number;
    resolution: number;
  };
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface RevenueQualityScore {
  overallScore: number;
  recurringPercentage: number;
  contractDuration: number;
  backlog: number;
  priceRealization: number;
  discountingTrend: number;
  collectionEfficiency: number;
  dso: number;
}

// News & Sentiment Types
export interface NewsSentimentInput {
  companyName: string;
  monitoringWindow?: number;
  sources?: string[];
}

export interface NewsSentiment {
  overallSentiment: number;
  sentimentTrend: Array<{ date: Date; score: number }>;
  keyEvents: NewsEvent[];
  managementChanges: ManagementChange[];
  litigation: LegalIssue[];
  partnerships: Partnership[];
  customerNews: CustomerNews[];
  esgConsiderations: ESGAnalysis;
  socialMedia: SocialMediaSentiment;
  alerts: Alert[];
  dataQuality: number;
}

export interface NewsEvent {
  date: Date;
  title: string;
  summary: string;
  sentiment: number;
  impact: 'low' | 'medium' | 'high';
  source: string;
  url: string;
}

export interface ManagementChange {
  date: Date;
  person: string;
  position: string;
  type: 'joined' | 'departed' | 'promoted';
  context: string;
  impact: string;
}

export interface LegalIssue {
  date: Date;
  type: string;
  description: string;
  status: 'active' | 'resolved' | 'pending';
  severity: Severity;
  potentialImpact: string;
}

export interface Partnership {
  date: Date;
  partner: string;
  type: string;
  description: string;
  strategicValue: string;
}

export interface CustomerNews {
  date: Date;
  customer?: string;
  type: 'win' | 'loss' | 'expansion';
  description: string;
  impact: string;
}

export interface ESGAnalysis {
  environmentalScore: number;
  socialScore: number;
  governanceScore: number;
  overallScore: number;
  controversies: string[];
  positiveInitiatives: string[];
}

export interface SocialMediaSentiment {
  overallSentiment: number;
  trendingTopics: string[];
  volume: number;
  influencerMentions: number;
}

export interface Alert {
  type: 'info' | 'warning' | 'critical';
  category: 'legal' | 'reputation' | 'management' | 'financial' | 'operational';
  message: string;
  triggeredAt: Date;
  requiresAction: boolean;
}

// Risk Assessment Types
export interface RiskAssessmentInput {
  companyName: string;
  industry?: string;
}

export type RiskCategory = 'low' | 'medium' | 'high' | 'critical';

export interface RiskFactor {
  name: string;
  probability: number;
  impact: number;
  description: string;
}

export interface RiskDomain {
  score: number;
  category: RiskCategory;
  factors: RiskFactor[];
  assessment: string;
}

export interface RiskItem {
  rank: number;
  category: string;
  description: string;
  probability: number;
  impact: number;
  score: number;
  severity: RiskCategory;
  indicators: string[];
}

export interface RiskScore {
  raw: number;
  adjusted: number;
  category: RiskCategory;
}

export interface MitigationStrategy {
  risk: string;
  strategy: string;
  effectiveness: number;
  effort: 'low' | 'medium' | 'high';
  timeline: string;
}

// Extended Risk Assessment with domains
export interface ExtendedRiskAssessment {
  overallRiskScore: number;
  riskCategory: 'low' | 'medium' | 'high' | 'critical';
  topRisks: Array<{ category: string; description: string; severity: Severity }>;
  mitigationStrategies: string[];
  dataQuality: number;
  executionRisk?: RiskDomain;
  marketRisk?: RiskDomain;
  technologyRisk?: RiskDomain;
  financialRisk?: RiskDomain;
  regulatoryRisk?: RiskDomain;
  integrationRisk?: RiskDomain;
}

// Technology Assessment Types
export interface TechnologyAnalysisInput {
  companyName: string;
  githubOrg?: string;
  repositories?: string[];
}

export interface TechnologyAssessment {
  architectureReview: ArchitectureAnalysis;
  codeQuality?: CodeQualityReport;
  techStack: TechStackAnalysis;
  securityPosture: SecurityAssessment;
  engineeringMetrics: EngineeringMetrics;
  innovation: InnovationMetrics;
  dataQuality: number;
}

export interface ArchitectureAnalysis {
  scalability: number;
  reliability: number;
  maintainability: number;
  patterns: string[];
  concerns: string[];
}

export interface CodeQualityReport {
  overallScore: number;
  testCoverage: number;
  codeComplexity: number;
  technicalDebt: number;
  documentation: number;
  dependencies: {
    total: number;
    outdated: number;
    vulnerable: number;
  };
}

export interface TechStackAnalysis {
  languages: Array<{ name: string; percentage: number }>;
  frameworks: string[];
  infrastructure: string[];
  databases: string[];
  modernization: number;
  riskFactors: string[];
}

export interface SecurityAssessment {
  overallScore: number;
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  complianceStatus: string[];
  securityPractices: string[];
  concerns: string[];
}

export interface EngineeringMetrics {
  releaseFrequency: number;
  deploymentSuccess: number;
  bugRate: number;
  velocity: number;
  teamSize: number;
}

export interface InnovationMetrics {
  rdEfficiency: number;
  patentCount: number;
  technicalDifferentiation: number;
  innovationScore: number;
}

// Synthesis & Reporting Types
export interface SynthesisInput {
  diligenceId: string;
  companyOverview: any; // Import CompanyOverview from diligence.ts in implementation
  allResults: Map<string, AgentExecutionResult>;
}

export interface InvestmentMemo {
  title: string;
  executiveSummary: any;
  investmentThesis: InvestmentThesis;
  companyOverview: any; // Import CompanyOverview from diligence.ts in implementation
  marketOpportunity: string;
  businessModel: string;
  financialAnalysis: string;
  competitivePosition: string;
  managementTeam: string;
  riskAssessment: string;
  valuation: string;
  recommendation: string;
  day100Plan: string;
  appendices: any[];
  generatedAt: Date;
}

export interface InvestmentThesis {
  overview: string;
  keyDrivers: string[];
  valueCreation: string[];
  exitStrategy: string;
  targetReturn: number;
  timeline: string;
}

export interface RedFlagReport {
  summary: string;
  criticalIssues: CriticalIssue[];
  highRiskAreas: HighRiskArea[];
  mediumConcerns: string[];
  informationGaps: any[]; // Import ResearchGap from diligence.ts in implementation
  recommendation: 'go' | 'no-go' | 'conditional';
  conditions?: string[];
  generatedAt: Date;
}

export interface CriticalIssue {
  title: string;
  description: string;
  severity: Severity;
  evidence: string[];
  immediateAction: string;
  dealBreaker: boolean;
}

export interface HighRiskArea {
  area: string;
  concerns: string[];
  deepDiveNeeded: boolean;
  suggestedActions: string[];
}

export interface Dashboard {
  overview: DashboardOverview;
  keyMetrics: DashboardMetric[];
  charts: DashboardChart[];
  alerts: Alert[];
  lastUpdated: Date;
}

export interface DashboardOverview {
  companyName: string;
  overallScore: number;
  recommendation: string;
  keyHighlights: string[];
  topRisks: string[];
}

export interface DashboardMetric {
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  change?: number;
  category: string;
}

export interface DashboardChart {
  type: 'line' | 'bar' | 'pie';
  title: string;
  data: any[];
}
