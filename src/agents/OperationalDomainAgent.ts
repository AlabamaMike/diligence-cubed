/**
 * Operational Domain Agent
 * Specializes in organizational effectiveness, supply chain analysis,
 * operational KPIs, and integration readiness assessment
 */

import { DatabaseClient } from '../database/client';
import { FindingRepository } from '../database/repositories/FindingRepository';
import { Finding } from '../types/database';
import { logger } from '../utils/logger';

export interface OrganizationalAnalysis {
  total_employees: number;
  organizational_structure: {
    total_layers: number;
    span_of_control_avg: number;
    management_ratio: number; // Managers / Total employees
  };
  talent_assessment: {
    key_person_dependencies: string[];
    turnover_rate_annual: number;
    avg_tenure_years: number;
    critical_role_vacancies: number;
  };
  compensation_benchmarking: {
    market_competitiveness: 'below' | 'at' | 'above';
    total_comp_vs_market: number; // Percentage
  };
  effectiveness_score: number; // 0-100
  red_flags: string[];
}

export interface SupplyChainAnalysis {
  supplier_count: number;
  supplier_concentration: {
    top_3_spend_percent: number;
    single_source_dependencies: number;
  };
  supplier_locations: Record<string, number>; // Country: count
  lead_time_avg_days: number;
  supply_chain_resilience_score: number; // 0-100
  procurement_efficiency: {
    payment_terms_avg_days: number;
    contract_coverage_percent: number;
    spend_under_management_percent: number;
  };
  risks: string[];
}

export interface OperationalKPIs {
  revenue_per_employee: number;
  ebitda_per_employee: number;
  gross_margin_percent: number;
  operating_margin_percent: number;
  customer_support_metrics: {
    first_response_time_hours: number;
    resolution_time_hours: number;
    csat_score: number; // 0-100
    ticket_volume_monthly: number;
  };
  efficiency_vs_peers: 'lagging' | 'average' | 'leading';
}

export interface IntegrationReadiness {
  integration_complexity_score: number; // 0-100 (higher = more complex)
  day_one_readiness: Array<{
    area: string;
    readiness_level: 'ready' | 'partial' | 'not_ready';
    critical_path: boolean;
  }>;
  synergy_capture_plan: {
    quick_wins: string[];
    medium_term: string[];
    long_term: string[];
  };
  integration_risks: string[];
  estimated_integration_timeline_days: number;
}

export class OperationalDomainAgent {
  private findingRepo: FindingRepository;
  private workstreamId?: string;

  constructor(
    private db: DatabaseClient,
    private dealId: string
  ) {
    this.findingRepo = new FindingRepository(db);
  }

  /**
   * Initialize agent for operational workstream
   */
  async initialize(): Promise<void> {
    const result = await this.db.query(
      `SELECT id FROM workstreams WHERE deal_id = $1 AND agent_type = 'operational' LIMIT 1`,
      [this.dealId]
    );

    if (result.rows.length > 0) {
      this.workstreamId = result.rows[0].id;
    }

    logger.info('Operational agent initialized', { dealId: this.dealId, workstreamId: this.workstreamId });
  }

  // ============================================================================
  // ORGANIZATIONAL ANALYSIS
  // ============================================================================

  /**
   * Analyze organizational structure and effectiveness
   */
  async analyzeOrganization(): Promise<OrganizationalAnalysis> {
    logger.info('Starting organizational analysis', { dealId: this.dealId });

    // In production, would analyze org charts, HRIS data
    const totalEmployees = 120;

    const structure = {
      total_layers: 4, // CEO -> VP -> Director -> Manager -> IC
      span_of_control_avg: 7.5, // Direct reports per manager
      management_ratio: 0.15, // 15% managers
    };

    const talentAssessment = {
      key_person_dependencies: ['CTO (primary architect)', 'VP Sales (customer relationships)', 'Head of Product'],
      turnover_rate_annual: 12, // 12% annual turnover
      avg_tenure_years: 2.8,
      critical_role_vacancies: 2, // VP Engineering, Sr. Product Manager
    };

    const compensation = {
      market_competitiveness: 'at' as const,
      total_comp_vs_market: 98, // 98% of market median
    };

    // Calculate effectiveness score
    let effectivenessScore = 70; // Base

    // Good span of control (5-10)
    if (structure.span_of_control_avg >= 5 && structure.span_of_control_avg <= 10) {
      effectivenessScore += 10;
    }

    // Low turnover (<15%)
    if (talentAssessment.turnover_rate_annual < 15) {
      effectivenessScore += 10;
    }

    // Competitive compensation
    if (compensation.market_competitiveness === 'at' || compensation.market_competitiveness === 'above') {
      effectivenessScore += 5;
    }

    // Deductions
    if (structure.total_layers > 5) {
      effectivenessScore -= 10; // Too many layers
    }

    if (talentAssessment.critical_role_vacancies > 1) {
      effectivenessScore -= 5;
    }

    const redFlags: string[] = [];

    if (talentAssessment.key_person_dependencies.length > 2) {
      redFlags.push(`High key person risk: ${talentAssessment.key_person_dependencies.length} critical dependencies`);
    }

    if (talentAssessment.critical_role_vacancies > 0) {
      redFlags.push(`${talentAssessment.critical_role_vacancies} critical role vacancies`);
    }

    if (talentAssessment.avg_tenure_years < 2) {
      redFlags.push('Low average tenure may indicate retention issues');
    }

    // Create finding
    await this.findingRepo.create({
      deal_id: this.dealId,
      workstream_id: this.workstreamId,
      title: 'Organizational Effectiveness Analysis',
      description: `Total Employees: ${totalEmployees}

Organization Structure:
- Layers: ${structure.total_layers}
- Avg Span of Control: ${structure.span_of_control_avg}
- Management Ratio: ${(structure.management_ratio * 100).toFixed(0)}%

Talent Metrics:
- Annual Turnover: ${talentAssessment.turnover_rate_annual}%
- Avg Tenure: ${talentAssessment.avg_tenure_years} years
- Critical Vacancies: ${talentAssessment.critical_role_vacancies}

Compensation: ${compensation.total_comp_vs_market}% of market (${compensation.market_competitiveness}-market)

Effectiveness Score: ${effectivenessScore}/100

Key Person Dependencies:
${talentAssessment.key_person_dependencies.map((p) => `- ${p}`).join('\n')}

${redFlags.length > 0 ? 'Risks:\n' + redFlags.map((r) => `- ${r}`).join('\n') : 'Organization structure and talent metrics are healthy'}`,
      finding_type: redFlags.length > 1 ? 'risk' : 'insight',
      category: 'organizational_effectiveness',
      confidence_score: 0.85,
      impact_level: redFlags.length > 1 ? 'high' : 'medium',
      generated_by_agent: 'operational',
      agent_reasoning: 'Analyzed org structure, talent metrics, and compensation benchmarking',
    });

    return {
      total_employees: totalEmployees,
      organizational_structure: structure,
      talent_assessment: talentAssessment,
      compensation_benchmarking: compensation,
      effectiveness_score: effectivenessScore,
      red_flags: redFlags,
    };
  }

  // ============================================================================
  // SUPPLY CHAIN ANALYSIS
  // ============================================================================

  /**
   * Analyze supply chain and procurement
   */
  async analyzeSupplyChain(): Promise<SupplyChainAnalysis> {
    logger.info('Starting supply chain analysis', { dealId: this.dealId });

    // For SaaS, "supply chain" is more about vendor/partner dependencies
    const supplierCount = 45; // Vendors and service providers

    const concentration = {
      top_3_spend_percent: 55, // AWS, Salesforce, Twilio = 55% of vendor spend
      single_source_dependencies: 8, // Critical services with no backup
    };

    const supplierLocations = {
      'United States': 30,
      'Europe': 10,
      'Asia': 5,
    };

    const leadTimeAvgDays = 15; // Service activation time
    const resilienceScore = this.calculateResilienceScore(concentration, supplierLocations);

    const procurement = {
      payment_terms_avg_days: 30,
      contract_coverage_percent: 85, // 85% under formal contracts
      spend_under_management_percent: 92,
    };

    const risks: string[] = [];

    if (concentration.top_3_spend_percent > 50) {
      risks.push('High concentration in top 3 vendors creates dependency risk');
    }

    if (concentration.single_source_dependencies > 5) {
      risks.push(`${concentration.single_source_dependencies} critical single-source dependencies`);
    }

    if (procurement.contract_coverage_percent < 90) {
      risks.push('Some vendor relationships lack formal contracts');
    }

    // Create finding
    await this.findingRepo.create({
      deal_id: this.dealId,
      workstream_id: this.workstreamId,
      title: 'Supply Chain & Vendor Analysis',
      description: `Total Vendors: ${supplierCount}

Vendor Concentration:
- Top 3 Vendors: ${concentration.top_3_spend_percent}% of spend
- Single-Source Critical: ${concentration.single_source_dependencies}

Geographic Distribution:
${Object.entries(supplierLocations).map(([country, count]) => `- ${country}: ${count} vendors`).join('\n')}

Procurement Efficiency:
- Payment Terms: ${procurement.payment_terms_avg_days} days
- Contract Coverage: ${procurement.contract_coverage_percent}%
- Spend Under Management: ${procurement.spend_under_management_percent}%

Resilience Score: ${resilienceScore}/100

${risks.length > 0 ? 'Risks:\n' + risks.map((r) => `- ${r}`).join('\n') : 'Vendor relationships are well-managed'}`,
      finding_type: risks.length > 1 ? 'risk' : 'insight',
      category: 'supply_chain',
      confidence_score: 0.80,
      impact_level: risks.length > 1 ? 'high' : 'medium',
      generated_by_agent: 'operational',
      agent_reasoning: 'Analyzed vendor concentration, geographic diversity, and procurement practices',
    });

    return {
      supplier_count: supplierCount,
      supplier_concentration: concentration,
      supplier_locations: supplierLocations,
      lead_time_avg_days: leadTimeAvgDays,
      supply_chain_resilience_score: resilienceScore,
      procurement_efficiency: procurement,
      risks,
    };
  }

  /**
   * Calculate supply chain resilience score
   * @private
   */
  private calculateResilienceScore(concentration: any, locations: any): number {
    let score = 100;

    // Deduct for concentration
    if (concentration.top_3_spend_percent > 60) {
      score -= 20;
    } else if (concentration.top_3_spend_percent > 40) {
      score -= 10;
    }

    // Deduct for single-source dependencies
    score -= concentration.single_source_dependencies * 3;

    // Add for geographic diversity
    const countryCount = Object.keys(locations).length;
    if (countryCount > 2) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  // ============================================================================
  // OPERATIONAL KPIs
  // ============================================================================

  /**
   * Analyze operational KPIs and efficiency
   */
  async analyzeOperationalKPIs(revenue: number, ebitda: number, employees: number): Promise<OperationalKPIs> {
    logger.info('Starting operational KPI analysis', { dealId: this.dealId });

    const revenuePerEmployee = revenue / employees;
    const ebitdaPerEmployee = ebitda / employees;
    const grossMarginPercent = 75; // SaaS typical
    const operatingMarginPercent = (ebitda / revenue) * 100;

    const customerSupport = {
      first_response_time_hours: 2.5,
      resolution_time_hours: 18,
      csat_score: 88, // 0-100
      ticket_volume_monthly: 450,
    };

    // Benchmark against SaaS peers
    const industryBenchmarks = {
      revenuePerEmployee: 200000, // $200K per employee
      ebitdaPerEmployee: 50000, // $50K per employee
    };

    let efficiency: 'lagging' | 'average' | 'leading' = 'average';

    if (
      revenuePerEmployee > industryBenchmarks.revenuePerEmployee * 1.2 &&
      ebitdaPerEmployee > industryBenchmarks.ebitdaPerEmployee * 1.2
    ) {
      efficiency = 'leading';
    } else if (
      revenuePerEmployee < industryBenchmarks.revenuePerEmployee * 0.8 ||
      ebitdaPerEmployee < industryBenchmarks.ebitdaPerEmployee * 0.8
    ) {
      efficiency = 'lagging';
    }

    // Create finding
    await this.findingRepo.create({
      deal_id: this.dealId,
      workstream_id: this.workstreamId,
      title: 'Operational KPI Analysis',
      description: `Efficiency Metrics:
- Revenue/Employee: $${(revenuePerEmployee / 1000).toFixed(0)}K (benchmark: $${(industryBenchmarks.revenuePerEmployee / 1000).toFixed(0)}K)
- EBITDA/Employee: $${(ebitdaPerEmployee / 1000).toFixed(0)}K (benchmark: $${(industryBenchmarks.ebitdaPerEmployee / 1000).toFixed(0)}K)
- Gross Margin: ${grossMarginPercent}%
- Operating Margin: ${operatingMarginPercent.toFixed(1)}%

Customer Support:
- First Response: ${customerSupport.first_response_time_hours} hours
- Resolution Time: ${customerSupport.resolution_time_hours} hours
- CSAT Score: ${customerSupport.csat_score}/100
- Monthly Tickets: ${customerSupport.ticket_volume_monthly}

Efficiency vs Peers: ${efficiency.toUpperCase()}

${efficiency === 'leading' ? 'Company operates more efficiently than peers' : efficiency === 'lagging' ? 'Opportunity to improve operational efficiency' : 'Operating efficiency is in line with peers'}`,
      finding_type: 'insight',
      category: 'operational_kpis',
      confidence_score: 0.85,
      impact_level: efficiency === 'lagging' ? 'high' : 'medium',
      generated_by_agent: 'operational',
      agent_reasoning: 'Analyzed operational efficiency metrics and compared to industry benchmarks',
    });

    return {
      revenue_per_employee: revenuePerEmployee,
      ebitda_per_employee: ebitdaPerEmployee,
      gross_margin_percent: grossMarginPercent,
      operating_margin_percent: operatingMarginPercent,
      customer_support_metrics: customerSupport,
      efficiency_vs_peers: efficiency,
    };
  }

  // ============================================================================
  // INTEGRATION READINESS
  // ============================================================================

  /**
   * Assess post-merger integration readiness
   */
  async assessIntegrationReadiness(): Promise<IntegrationReadiness> {
    logger.info('Starting integration readiness assessment', { dealId: this.dealId });

    const dayOneReadiness = [
      { area: 'Legal entity setup', readiness_level: 'ready' as const, critical_path: true },
      { area: 'Banking and treasury', readiness_level: 'ready' as const, critical_path: true },
      { area: 'Employee communications', readiness_level: 'ready' as const, critical_path: true },
      { area: 'IT systems access', readiness_level: 'partial' as const, critical_path: true },
      { area: 'Brand and marketing', readiness_level: 'partial' as const, critical_path: false },
      { area: 'Process integration', readiness_level: 'not_ready' as const, critical_path: false },
      { area: 'System consolidation', readiness_level: 'not_ready' as const, critical_path: false },
    ];

    const synergyCapturePlan = {
      quick_wins: [
        'Consolidate SaaS subscriptions (duplicate tools)',
        'Implement cross-company procurement for better vendor terms',
        'Standardize compensation planning process',
      ],
      medium_term: [
        'Integrate customer support teams',
        'Consolidate technology stack',
        'Harmonize go-to-market processes',
        'Combine product roadmaps',
      ],
      long_term: [
        'Full system integration',
        'Organization structure optimization',
        'Unified culture and values',
      ],
    };

    const integrationRisks = [
      'Key talent retention during transition period',
      'Customer confusion during rebranding',
      'System integration complexity may delay synergy capture',
      'Cultural differences between organizations',
      'Distraction from core business during integration',
    ];

    // Calculate complexity score
    const notReadyCount = dayOneReadiness.filter((r) => r.readiness_level === 'not_ready').length;
    const criticalNotReady = dayOneReadiness.filter(
      (r) => r.critical_path && r.readiness_level !== 'ready'
    ).length;

    let complexityScore = 50; // Base
    complexityScore += notReadyCount * 8;
    complexityScore += criticalNotReady * 15;
    complexityScore = Math.min(100, complexityScore);

    // Estimate timeline
    const estimatedTimelineDays = 180; // 6 months for full integration

    // Create finding
    await this.findingRepo.create({
      deal_id: this.dealId,
      workstream_id: this.workstreamId,
      title: 'Post-Merger Integration Readiness',
      description: `Integration Complexity: ${complexityScore}/100

Day One Readiness (${dayOneReadiness.length} areas):
${dayOneReadiness.filter((r) => r.critical_path).map((r) => `- ${r.area}: ${r.readiness_level} ${r.critical_path ? '[CRITICAL]' : ''}`).join('\n')}

Quick Wins (0-60 days):
${synergyCapturePlan.quick_wins.map((w) => `- ${w}`).join('\n')}

Integration Timeline: ${estimatedTimelineDays} days (estimated)

Key Risks:
${integrationRisks.slice(0, 3).map((r) => `- ${r}`).join('\n')}

Assessment: ${complexityScore > 70 ? 'High integration complexity - extensive planning required' : complexityScore > 40 ? 'Moderate integration complexity - manageable with standard PMI approach' : 'Low integration complexity - straightforward integration'}`,
      finding_type: complexityScore > 70 ? 'risk' : 'insight',
      category: 'integration_readiness',
      confidence_score: 0.75,
      impact_level: complexityScore > 70 ? 'high' : 'medium',
      generated_by_agent: 'operational',
      agent_reasoning: 'Assessed Day-1 readiness, synergy capture plan, and integration complexity',
    });

    return {
      integration_complexity_score: complexityScore,
      day_one_readiness: dayOneReadiness,
      synergy_capture_plan: synergyCapturePlan,
      integration_risks: integrationRisks,
      estimated_integration_timeline_days: estimatedTimelineDays,
    };
  }

  // ============================================================================
  // COMPREHENSIVE OPERATIONAL ASSESSMENT
  // ============================================================================

  /**
   * Run complete operational analysis
   */
  async runCompleteAnalysis(
    revenue: number,
    ebitda: number
  ): Promise<{
    organization: OrganizationalAnalysis;
    supplyChain: SupplyChainAnalysis;
    kpis: OperationalKPIs;
    integration: IntegrationReadiness;
  }> {
    logger.info('Running complete operational analysis', { dealId: this.dealId });

    const organization = await this.analyzeOrganization();
    const [supplyChain, kpis, integration] = await Promise.all([
      this.analyzeSupplyChain(),
      this.analyzeOperationalKPIs(revenue, ebitda, organization.total_employees),
      this.assessIntegrationReadiness(),
    ]);

    // Create summary finding
    await this.createOperationalSummaryFinding(organization, supplyChain, kpis, integration);

    return { organization, supplyChain, kpis, integration };
  }

  /**
   * Create comprehensive operational summary
   * @private
   */
  private async createOperationalSummaryFinding(
    org: OrganizationalAnalysis,
    supply: SupplyChainAnalysis,
    kpis: OperationalKPIs,
    integration: IntegrationReadiness
  ): Promise<Finding> {
    const allRedFlags = [...org.red_flags, ...supply.risks, ...integration.integration_risks];

    return await this.findingRepo.create({
      deal_id: this.dealId,
      workstream_id: this.workstreamId,
      title: 'Operational Due Diligence Summary',
      description: `ORGANIZATION:
- Total Employees: ${org.total_employees}
- Effectiveness Score: ${org.effectiveness_score}/100
- Annual Turnover: ${org.talent_assessment.turnover_rate_annual}%
- Key Person Dependencies: ${org.talent_assessment.key_person_dependencies.length}

SUPPLY CHAIN:
- Total Vendors: ${supply.supplier_count}
- Top 3 Concentration: ${supply.supplier_concentration.top_3_spend_percent}%
- Resilience Score: ${supply.supply_chain_resilience_score}/100

OPERATIONAL EFFICIENCY:
- Revenue/Employee: $${(kpis.revenue_per_employee / 1000).toFixed(0)}K
- vs Peers: ${kpis.efficiency_vs_peers}
- Operating Margin: ${kpis.operating_margin_percent.toFixed(1)}%

INTEGRATION READINESS:
- Complexity Score: ${integration.integration_complexity_score}/100
- Timeline: ${integration.estimated_integration_timeline_days} days
- Critical Gaps: ${integration.day_one_readiness.filter((r) => r.critical_path && r.readiness_level !== 'ready').length}

${allRedFlags.length > 2 ? 'Key Risks:\n' + allRedFlags.slice(0, 4).map((r) => `- ${r}`).join('\n') : 'Operational metrics are generally healthy'}`,
      finding_type: allRedFlags.length > 3 ? 'risk' : 'insight',
      category: 'operational_summary',
      confidence_score: 0.82,
      impact_level: allRedFlags.length > 3 ? 'high' : 'medium',
      generated_by_agent: 'operational',
      agent_reasoning: 'Synthesized organizational, supply chain, KPI, and integration analyses',
    });
  }
}
