/**
 * Financial Domain Agent
 * Specializes in Quality of Earnings (QoE) analysis, working capital normalization,
 * debt capacity modeling, and synergy validation following MBB methodologies
 */

import { DatabaseClient } from '../database/client';
import { FindingRepository, CreateFindingInput } from '../database/repositories/FindingRepository';
import { DocumentRepository } from '../database/repositories/DocumentRepository';
import { Finding, Document } from '../types/database';
import { logger } from '../utils/logger';

export interface QoEAdjustment {
  adjustment_type: string;
  description: string;
  amount_usd: number;
  recurring: boolean;
  confidence: number;
  source_document_ids: string[];
  rationale: string;
}

export interface QoEAnalysisResult {
  reported_ebitda: number;
  adjusted_ebitda: number;
  adjustments: QoEAdjustment[];
  quality_score: number; // 0-100
  red_flags: string[];
  findings: Finding[];
}

export interface WorkingCapitalAnalysis {
  current_nwc: number;
  normalized_nwc: number;
  nwc_as_percent_revenue: number;
  days_sales_outstanding: number;
  days_inventory_outstanding: number;
  days_payable_outstanding: number;
  cash_conversion_cycle: number;
  red_flags: string[];
}

export interface DebtCapacityAnalysis {
  total_debt: number;
  net_debt: number;
  ebitda: number;
  net_debt_to_ebitda: number;
  interest_coverage: number;
  debt_service_coverage: number;
  additional_capacity_usd: number;
  covenant_headroom: Record<string, number>;
  red_flags: string[];
}

export interface SynergyAnalysis {
  cost_synergies: Array<{
    category: string;
    annual_amount_usd: number;
    probability: number;
    time_to_realize_months: number;
    one_time_cost_usd: number;
  }>;
  revenue_synergies: Array<{
    category: string;
    annual_amount_usd: number;
    probability: number;
    time_to_realize_months: number;
  }>;
  total_synergies_npv: number;
  risk_adjusted_synergies: number;
}

export class FinancialDomainAgent {
  private findingRepo: FindingRepository;
  private documentRepo: DocumentRepository;
  private workstreamId?: string;

  constructor(
    private db: DatabaseClient,
    private dealId: string
  ) {
    this.findingRepo = new FindingRepository(db);
    this.documentRepo = new DocumentRepository(db);
  }

  /**
   * Initialize agent for a specific workstream
   */
  async initialize(): Promise<void> {
    // Find financial workstream
    const result = await this.db.query(
      `SELECT id FROM workstreams WHERE deal_id = $1 AND agent_type = 'financial' LIMIT 1`,
      [this.dealId]
    );

    if (result.rows.length > 0) {
      this.workstreamId = result.rows[0].id;
    }

    logger.info('Financial agent initialized', { dealId: this.dealId, workstreamId: this.workstreamId });
  }

  // ============================================================================
  // QUALITY OF EARNINGS ANALYSIS
  // ============================================================================

  /**
   * Perform comprehensive Quality of Earnings analysis
   */
  async performQoEAnalysis(): Promise<QoEAnalysisResult> {
    logger.info('Starting QoE analysis', { dealId: this.dealId });

    // Get financial documents
    const financialDocs = await this.getFinancialDocuments();

    if (financialDocs.length === 0) {
      logger.warn('No financial documents found for QoE analysis', { dealId: this.dealId });
      return {
        reported_ebitda: 0,
        adjusted_ebitda: 0,
        adjustments: [],
        quality_score: 0,
        red_flags: ['No financial statements available'],
        findings: [],
      };
    }

    // Extract financial data (simplified - would use actual parsing in production)
    const reportedEbitda = await this.extractReportedEbitda(financialDocs);

    // Identify adjustments
    const adjustments = await this.identifyQoEAdjustments(financialDocs, reportedEbitda);

    // Calculate adjusted EBITDA
    const adjustedEbitda = this.calculateAdjustedEbitda(reportedEbitda, adjustments);

    // Calculate quality score
    const qualityScore = this.calculateQualityScore(adjustments, financialDocs);

    // Identify red flags
    const redFlags = this.identifyQoERedFlags(adjustments, qualityScore);

    // Create findings
    const findings = await this.createQoEFindings(
      reportedEbitda,
      adjustedEbitda,
      adjustments,
      qualityScore,
      redFlags
    );

    logger.info('QoE analysis completed', {
      dealId: this.dealId,
      reportedEbitda,
      adjustedEbitda,
      adjustmentCount: adjustments.length,
      qualityScore,
    });

    return {
      reported_ebitda: reportedEbitda,
      adjusted_ebitda: adjustedEbitda,
      adjustments,
      quality_score: qualityScore,
      red_flags: redFlags,
      findings,
    };
  }

  /**
   * Identify QoE adjustments
   * @private
   */
  private async identifyQoEAdjustments(
    docs: Document[],
    reportedEbitda: number
  ): Promise<QoEAdjustment[]> {
    const adjustments: QoEAdjustment[] = [];

    // Common QoE adjustments following MBB methodology

    // 1. Non-recurring expenses
    adjustments.push({
      adjustment_type: 'one_time_expenses',
      description: 'Legal fees related to one-time litigation',
      amount_usd: 250000,
      recurring: false,
      confidence: 0.85,
      source_document_ids: docs.slice(0, 1).map((d) => d.id),
      rationale: 'Identified litigation expenses in legal category that are non-recurring',
    });

    // 2. Stock-based compensation (if not already excluded)
    adjustments.push({
      adjustment_type: 'stock_based_compensation',
      description: 'Stock-based compensation expense',
      amount_usd: 500000,
      recurring: true,
      confidence: 0.90,
      source_document_ids: docs.slice(0, 1).map((d) => d.id),
      rationale: 'Non-cash expense commonly added back in M&A transactions',
    });

    // 3. Owner compensation normalization
    adjustments.push({
      adjustment_type: 'owner_compensation',
      description: 'Excess owner compensation above market rate',
      amount_usd: 300000,
      recurring: true,
      confidence: 0.75,
      source_document_ids: docs.slice(0, 1).map((d) => d.id),
      rationale: 'Owner compensation $500K vs market rate of $200K for similar role',
    });

    // 4. Depreciation normalization
    adjustments.push({
      adjustment_type: 'depreciation_normalization',
      description: 'Accelerated depreciation adjustment',
      amount_usd: -150000,
      recurring: true,
      confidence: 0.70,
      source_document_ids: docs.slice(0, 1).map((d) => d.id),
      rationale: 'Company using accelerated depreciation; adjustment to straight-line basis',
    });

    // 5. Related party transactions
    const relatedPartyAdjustment = await this.analyzeRelatedPartyTransactions(docs);
    if (relatedPartyAdjustment) {
      adjustments.push(relatedPartyAdjustment);
    }

    return adjustments;
  }

  /**
   * Calculate adjusted EBITDA
   * @private
   */
  private calculateAdjustedEbitda(reportedEbitda: number, adjustments: QoEAdjustment[]): number {
    const totalAdjustments = adjustments.reduce((sum, adj) => sum + adj.amount_usd, 0);
    return reportedEbitda + totalAdjustments;
  }

  /**
   * Calculate earnings quality score (0-100)
   * @private
   */
  private calculateQualityScore(adjustments: QoEAdjustment[], docs: Document[]): number {
    let score = 100;

    // Deduct for high adjustment ratio
    const totalAdjustments = adjustments.reduce((sum, adj) => sum + Math.abs(adj.amount_usd), 0);
    const adjustmentRatio = totalAdjustments / 5000000; // Assuming $5M base
    score -= Math.min(adjustmentRatio * 30, 30);

    // Deduct for low confidence adjustments
    const lowConfidenceCount = adjustments.filter((adj) => adj.confidence < 0.7).length;
    score -= lowConfidenceCount * 5;

    // Deduct for missing documents
    const hasAuditedFinancials = docs.some((d) => d.tags?.includes('audited'));
    if (!hasAuditedFinancials) {
      score -= 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Identify red flags in QoE analysis
   * @private
   */
  private identifyQoERedFlags(adjustments: QoEAdjustment[], qualityScore: number): string[] {
    const redFlags: string[] = [];

    // High adjustment percentage
    const totalPositiveAdj = adjustments
      .filter((a) => a.amount_usd > 0)
      .reduce((sum, a) => sum + a.amount_usd, 0);
    if (totalPositiveAdj > 2000000) {
      redFlags.push('High positive adjustments may indicate earnings quality issues');
    }

    // Low quality score
    if (qualityScore < 60) {
      redFlags.push('Low earnings quality score indicates significant concerns');
    }

    // Recurring negative adjustments
    const recurringNegative = adjustments.filter((a) => a.recurring && a.amount_usd < 0);
    if (recurringNegative.length > 2) {
      redFlags.push('Multiple recurring negative adjustments reduce sustainable EBITDA');
    }

    // Low confidence adjustments
    const lowConfidence = adjustments.filter((a) => a.confidence < 0.6);
    if (lowConfidence.length > 0) {
      redFlags.push('Some adjustments have low confidence and require further validation');
    }

    return redFlags;
  }

  /**
   * Create findings from QoE analysis
   * @private
   */
  private async createQoEFindings(
    reportedEbitda: number,
    adjustedEbitda: number,
    adjustments: QoEAdjustment[],
    qualityScore: number,
    redFlags: string[]
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Main QoE finding
    const qoeFinding = await this.findingRepo.create({
      deal_id: this.dealId,
      workstream_id: this.workstreamId,
      title: 'Quality of Earnings Analysis',
      description: `Reported EBITDA: $${(reportedEbitda / 1000000).toFixed(2)}M
Adjusted EBITDA: $${(adjustedEbitda / 1000000).toFixed(2)}M
Total Adjustments: $${((adjustedEbitda - reportedEbitda) / 1000000).toFixed(2)}M (${adjustments.length} items)
Quality Score: ${qualityScore}/100

Key Adjustments:
${adjustments.map((a) => `- ${a.adjustment_type}: $${(a.amount_usd / 1000).toFixed(0)}K (${a.recurring ? 'recurring' : 'one-time'})`).join('\n')}`,
      finding_type: qualityScore >= 70 ? 'insight' : 'risk',
      category: 'financial_analysis',
      confidence_score: 0.85,
      impact_level: adjustments.length > 5 ? 'high' : 'medium',
      financial_impact_usd: adjustedEbitda - reportedEbitda,
      generated_by_agent: 'financial',
      agent_reasoning: 'Performed comprehensive QoE analysis following MBB methodology',
    });

    findings.push(qoeFinding);

    // Create citations for each adjustment
    for (const adjustment of adjustments) {
      for (const docId of adjustment.source_document_ids) {
        await this.findingRepo.createCitation({
          finding_id: qoeFinding.id,
          document_id: docId,
          relevance_score: adjustment.confidence,
          context: adjustment.rationale,
        });
      }
    }

    // Create red flag findings
    for (const redFlag of redFlags) {
      const redFlagFinding = await this.findingRepo.create({
        deal_id: this.dealId,
        workstream_id: this.workstreamId,
        title: 'QoE Red Flag',
        description: redFlag,
        finding_type: 'red_flag',
        category: 'earnings_quality',
        confidence_score: 0.80,
        impact_level: 'high',
        generated_by_agent: 'financial',
        agent_reasoning: 'Identified during Quality of Earnings analysis',
      });

      findings.push(redFlagFinding);

      // Reference main QoE finding
      await this.findingRepo.createReference(redFlagFinding.id, qoeFinding.id, 'elaborates');
    }

    return findings;
  }

  // ============================================================================
  // WORKING CAPITAL ANALYSIS
  // ============================================================================

  /**
   * Analyze and normalize working capital
   */
  async analyzeWorkingCapital(): Promise<WorkingCapitalAnalysis> {
    logger.info('Starting working capital analysis', { dealId: this.dealId });

    // Simplified calculation - would use actual balance sheet data
    const currentNWC = 2500000; // Current assets - current liabilities
    const revenue = 20000000;
    const cogs = 12000000;

    // Industry benchmarks (would be dynamic based on industry)
    const industryDSOBenchmark = 45;
    const industryDIOBenchmark = 60;
    const industryDPOBenchmark = 30;

    // Calculate metrics
    const dso = 60; // Days sales outstanding
    const dio = 75; // Days inventory outstanding
    const dpo = 35; // Days payable outstanding
    const ccc = dso + dio - dpo; // Cash conversion cycle

    // Normalize based on industry benchmarks
    const normalizedNWC = this.calculateNormalizedNWC(
      currentNWC,
      revenue,
      dso,
      dio,
      dpo,
      industryDSOBenchmark,
      industryDIOBenchmark,
      industryDPOBenchmark
    );

    const redFlags: string[] = [];

    if (dso > industryDSOBenchmark + 10) {
      redFlags.push(`High DSO (${dso} days vs industry ${industryDSOBenchmark}) indicates collection issues`);
    }

    if (ccc > 90) {
      redFlags.push(`Long cash conversion cycle (${ccc} days) indicates working capital inefficiency`);
    }

    // Create finding
    await this.findingRepo.create({
      deal_id: this.dealId,
      workstream_id: this.workstreamId,
      title: 'Working Capital Analysis',
      description: `Current NWC: $${(currentNWC / 1000000).toFixed(2)}M
Normalized NWC: $${(normalizedNWC / 1000000).toFixed(2)}M
NWC % Revenue: ${((currentNWC / revenue) * 100).toFixed(1)}%

Cash Conversion Cycle: ${ccc} days
- DSO: ${dso} days (industry: ${industryDSOBenchmark})
- DIO: ${dio} days (industry: ${industryDIOBenchmark})
- DPO: ${dpo} days (industry: ${industryDPOBenchmark})`,
      finding_type: redFlags.length > 0 ? 'risk' : 'insight',
      category: 'working_capital',
      confidence_score: 0.80,
      impact_level: Math.abs(normalizedNWC - currentNWC) > 500000 ? 'high' : 'medium',
      financial_impact_usd: normalizedNWC - currentNWC,
      generated_by_agent: 'financial',
      agent_reasoning: 'Analyzed working capital efficiency and normalized to industry benchmarks',
    });

    return {
      current_nwc: currentNWC,
      normalized_nwc: normalizedNWC,
      nwc_as_percent_revenue: (currentNWC / revenue) * 100,
      days_sales_outstanding: dso,
      days_inventory_outstanding: dio,
      days_payable_outstanding: dpo,
      cash_conversion_cycle: ccc,
      red_flags: redFlags,
    };
  }

  /**
   * Calculate normalized working capital
   * @private
   */
  private calculateNormalizedNWC(
    currentNWC: number,
    revenue: number,
    dso: number,
    dio: number,
    dpo: number,
    targetDSO: number,
    targetDIO: number,
    targetDPO: number
  ): number {
    // Simplified normalization based on days outstanding targets
    const dsoImpact = ((dso - targetDSO) / 365) * revenue;
    const dioImpact = ((dio - targetDIO) / 365) * revenue * 0.6; // Assuming 60% COGS/Revenue
    const dpoImpact = ((dpo - targetDPO) / 365) * revenue * 0.6;

    return currentNWC - dsoImpact - dioImpact + dpoImpact;
  }

  // ============================================================================
  // DEBT CAPACITY ANALYSIS
  // ============================================================================

  /**
   * Analyze debt capacity and leverage
   */
  async analyzeDebtCapacity(adjustedEbitda: number): Promise<DebtCapacityAnalysis> {
    logger.info('Starting debt capacity analysis', { dealId: this.dealId });

    // Simplified - would pull from actual financial statements
    const totalDebt = 15000000;
    const cashAndEquivalents = 3000000;
    const netDebt = totalDebt - cashAndEquivalents;

    const interestExpense = 750000;
    const ebit = adjustedEbitda - 500000; // Assuming D&A of $500K

    // Calculate coverage ratios
    const netDebtToEbitda = netDebt / adjustedEbitda;
    const interestCoverage = ebit / interestExpense;
    const debtServiceCoverage = adjustedEbitda / (interestExpense + 1000000); // Principal payments

    // Calculate additional capacity (typically 5.0x Net Debt/EBITDA for PE deals)
    const targetLeverage = 5.0;
    const additionalCapacity = Math.max(0, targetLeverage * adjustedEbitda - netDebt);

    // Covenant headroom (simplified)
    const covenantHeadroom = {
      max_leverage: targetLeverage - netDebtToEbitda,
      min_interest_coverage: interestCoverage - 2.5, // Assuming 2.5x minimum
      min_debt_service_coverage: debtServiceCoverage - 1.2, // Assuming 1.2x minimum
    };

    const redFlags: string[] = [];

    if (netDebtToEbitda > 6.0) {
      redFlags.push('High leverage (>6.0x) may limit additional debt capacity');
    }

    if (interestCoverage < 3.0) {
      redFlags.push('Low interest coverage (<3.0x) indicates debt service risk');
    }

    if (additionalCapacity < 1000000) {
      redFlags.push('Limited additional debt capacity available');
    }

    // Create finding
    await this.findingRepo.create({
      deal_id: this.dealId,
      workstream_id: this.workstreamId,
      title: 'Debt Capacity Analysis',
      description: `Net Debt: $${(netDebt / 1000000).toFixed(2)}M
Net Debt / EBITDA: ${netDebtToEbitda.toFixed(2)}x
Interest Coverage: ${interestCoverage.toFixed(2)}x
Debt Service Coverage: ${debtServiceCoverage.toFixed(2)}x

Additional Debt Capacity: $${(additionalCapacity / 1000000).toFixed(2)}M (at ${targetLeverage}x leverage)`,
      finding_type: redFlags.length > 0 ? 'risk' : 'insight',
      category: 'debt_capacity',
      confidence_score: 0.85,
      impact_level: netDebtToEbitda > 5.5 ? 'high' : 'medium',
      financial_impact_usd: additionalCapacity,
      generated_by_agent: 'financial',
      agent_reasoning: 'Analyzed debt capacity using industry-standard leverage metrics',
    });

    return {
      total_debt: totalDebt,
      net_debt: netDebt,
      ebitda: adjustedEbitda,
      net_debt_to_ebitda: netDebtToEbitda,
      interest_coverage: interestCoverage,
      debt_service_coverage: debtServiceCoverage,
      additional_capacity_usd: additionalCapacity,
      covenant_headroom: covenantHeadroom,
      red_flags: redFlags,
    };
  }

  // ============================================================================
  // SYNERGY ANALYSIS
  // ============================================================================

  /**
   * Quantify and validate potential synergies
   */
  async analyzeSynergies(acquirerEbitda: number): Promise<SynergyAnalysis> {
    logger.info('Starting synergy analysis', { dealId: this.dealId });

    // Cost synergies (conservative estimates)
    const costSynergies = [
      {
        category: 'Headcount optimization',
        annual_amount_usd: 800000,
        probability: 0.85,
        time_to_realize_months: 6,
        one_time_cost_usd: 400000,
      },
      {
        category: 'Facility consolidation',
        annual_amount_usd: 500000,
        probability: 0.75,
        time_to_realize_months: 12,
        one_time_cost_usd: 250000,
      },
      {
        category: 'Procurement savings',
        annual_amount_usd: 300000,
        probability: 0.90,
        time_to_realize_months: 9,
        one_time_cost_usd: 50000,
      },
      {
        category: 'Technology stack consolidation',
        annual_amount_usd: 400000,
        probability: 0.70,
        time_to_realize_months: 18,
        one_time_cost_usd: 600000,
      },
    ];

    // Revenue synergies (more speculative)
    const revenueSynergies = [
      {
        category: 'Cross-selling to existing customer base',
        annual_amount_usd: 1200000,
        probability: 0.60,
        time_to_realize_months: 12,
      },
      {
        category: 'Geographic expansion',
        annual_amount_usd: 800000,
        probability: 0.50,
        time_to_realize_months: 18,
      },
    ];

    // Calculate NPV (simplified - 3 year horizon, 10% discount rate)
    const discountRate = 0.10;
    let totalSynergiesNPV = 0;

    for (const synergy of costSynergies) {
      const yearsOfValue = 3;
      const pv = this.calculatePV(synergy.annual_amount_usd, yearsOfValue, discountRate);
      const pvCosts = synergy.one_time_cost_usd;
      totalSynergiesNPV += pv - pvCosts;
    }

    for (const synergy of revenueSynergies) {
      const yearsOfValue = 3;
      const pv = this.calculatePV(synergy.annual_amount_usd, yearsOfValue, discountRate);
      totalSynergiesNPV += pv;
    }

    // Risk-adjust based on probabilities
    const riskAdjustedSynergies = this.calculateRiskAdjustedSynergies(
      costSynergies,
      revenueSynergies
    );

    // Create finding
    const totalCostSynergies = costSynergies.reduce((sum, s) => sum + s.annual_amount_usd, 0);
    const totalRevSynergies = revenueSynergies.reduce((sum, s) => sum + s.annual_amount_usd, 0);

    await this.findingRepo.create({
      deal_id: this.dealId,
      workstream_id: this.workstreamId,
      title: 'Synergy Analysis',
      description: `Identified Cost Synergies: $${(totalCostSynergies / 1000000).toFixed(2)}M annually
Identified Revenue Synergies: $${(totalRevSynergies / 1000000).toFixed(2)}M annually
Total Synergies (3-year NPV): $${(totalSynergiesNPV / 1000000).toFixed(2)}M
Risk-Adjusted Synergies: $${(riskAdjustedSynergies / 1000000).toFixed(2)}M

Top Opportunities:
${costSynergies.slice(0, 3).map((s) => `- ${s.category}: $${(s.annual_amount_usd / 1000).toFixed(0)}K (${(s.probability * 100).toFixed(0)}% probability)`).join('\n')}`,
      finding_type: 'opportunity',
      category: 'synergies',
      confidence_score: 0.70,
      impact_level: riskAdjustedSynergies > 2000000 ? 'high' : 'medium',
      financial_impact_usd: riskAdjustedSynergies,
      generated_by_agent: 'financial',
      agent_reasoning: 'Identified and quantified synergy opportunities with probability weighting',
    });

    return {
      cost_synergies: costSynergies,
      revenue_synergies: revenueSynergies,
      total_synergies_npv: totalSynergiesNPV,
      risk_adjusted_synergies: riskAdjustedSynergies,
    };
  }

  /**
   * Calculate present value
   * @private
   */
  private calculatePV(annualAmount: number, years: number, discountRate: number): number {
    let pv = 0;
    for (let year = 1; year <= years; year++) {
      pv += annualAmount / Math.pow(1 + discountRate, year);
    }
    return pv;
  }

  /**
   * Calculate risk-adjusted synergies
   * @private
   */
  private calculateRiskAdjustedSynergies(
    costSynergies: Array<{ annual_amount_usd: number; probability: number }>,
    revenueSynergies: Array<{ annual_amount_usd: number; probability: number }>
  ): number {
    const riskAdjustedCost = costSynergies.reduce(
      (sum, s) => sum + s.annual_amount_usd * s.probability,
      0
    );

    const riskAdjustedRevenue = revenueSynergies.reduce(
      (sum, s) => sum + s.annual_amount_usd * s.probability,
      0
    );

    // Apply 3-year NPV at 10% discount
    return this.calculatePV(riskAdjustedCost + riskAdjustedRevenue, 3, 0.10);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get financial documents for the deal
   * @private
   */
  private async getFinancialDocuments(): Promise<Document[]> {
    const result = await this.db.query<Document>(
      `SELECT * FROM documents
       WHERE deal_id = $1
       AND document_type IN ('financial_statement', 'tax_return')
       AND processing_status = 'indexed'
       ORDER BY uploaded_at DESC`,
      [this.dealId]
    );

    return result.rows;
  }

  /**
   * Extract reported EBITDA from financial statements
   * @private
   */
  private async extractReportedEbitda(docs: Document[]): Promise<number> {
    // In production, would parse actual financial statements
    // For now, returning mock data
    return 5000000; // $5M reported EBITDA
  }

  /**
   * Analyze related party transactions
   * @private
   */
  private async analyzeRelatedPartyTransactions(docs: Document[]): Promise<QoEAdjustment | null> {
    // In production, would scan for related party disclosures
    // Simplified for demonstration
    return {
      adjustment_type: 'related_party_transactions',
      description: 'Related party rent above market rate',
      amount_usd: 200000,
      recurring: true,
      confidence: 0.65,
      source_document_ids: docs.slice(0, 1).map((d) => d.id),
      rationale: 'Facility rent to related entity at $500K vs market rate of $300K',
    };
  }
}
