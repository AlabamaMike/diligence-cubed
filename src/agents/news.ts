/**
 * News & Sentiment Agent
 * Real-time monitoring and reputation analysis
 */

import { BaseAgent } from './base';
import {
  NewsSentimentInput,
  NewsSentiment,
  NewsEvent,
  ManagementChange,
  LegalIssue,
  Partnership,
  CustomerNews,
  ESGAnalysis,
  SocialMediaSentiment,
  Alert,
  AgentError,
} from '../types/agents';

export class NewsSentimentAgent extends BaseAgent {
  constructor() {
    super({
      name: 'news-sentiment-agent',
      type: 'news',
      maxRetries: 3,
      timeout: 300000,
    });
  }

  protected validateInput(input: NewsSentimentInput): void {
    super.validateInput(input);
    if (!input.companyName) {
      throw new AgentError('Company name is required', this.type);
    }
  }

  protected async executeInternal(input: NewsSentimentInput): Promise<NewsSentiment> {
    this.log('info', `Monitoring news and sentiment for ${input.companyName}`);

    try {
      const monitoringWindow = input.monitoringWindow || 90; // default 90 days

      const keyEvents = await this.gatherKeyEvents(input, monitoringWindow);
      const managementChanges = await this.trackManagementChanges(input, monitoringWindow);
      const litigation = await this.monitorLitigation(input);
      const partnerships = await this.trackPartnerships(input, monitoringWindow);
      const customerNews = await this.gatherCustomerNews(input, monitoringWindow);
      const esgConsiderations = await this.analyzeESG(input);
      const socialMedia = await this.analyzeSocialMedia(input);
      const alerts = await this.generateAlerts(input, {
        keyEvents,
        managementChanges,
        litigation,
      });

      const sentimentTrend = this.calculateSentimentTrend(keyEvents);
      const overallSentiment = this.calculateOverallSentiment(sentimentTrend);

      this.updateMetrics({
        dataPoints: keyEvents.length + managementChanges.length,
        sources: ['NewsAPI', 'Twitter', 'LinkedIn', 'Exa.ai'],
      });

      return {
        overallSentiment,
        sentimentTrend,
        keyEvents,
        managementChanges,
        litigation,
        partnerships,
        customerNews,
        esgConsiderations,
        socialMedia,
        alerts,
        dataQuality: this.calculateConfidence(),
      };
    } catch (error) {
      this.handleError(error, 'news sentiment analysis');
    }
  }

  private async gatherKeyEvents(
    _input: NewsSentimentInput,
    _days: number
  ): Promise<NewsEvent[]> {
    this.log('info', `Gathering key events from last ${_days} days`);

    // Placeholder - would use real news APIs
    return [
      {
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        title: 'Company Announces Major Product Launch',
        summary: 'New product line targeting enterprise customers',
        sentiment: 0.8,
        impact: 'high',
        source: 'TechCrunch',
        url: 'https://example.com/news/1',
      },
      {
        date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        title: 'Q3 Earnings Beat Expectations',
        summary: 'Strong revenue growth and improved margins',
        sentiment: 0.9,
        impact: 'high',
        source: 'Financial Times',
        url: 'https://example.com/news/2',
      },
      {
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        title: 'Minor Service Outage Affects Users',
        summary: 'Two-hour outage resolved, no data loss',
        sentiment: -0.4,
        impact: 'medium',
        source: 'The Verge',
        url: 'https://example.com/news/3',
      },
    ];
  }

  private async trackManagementChanges(
    _input: NewsSentimentInput,
    _days: number
  ): Promise<ManagementChange[]> {
    this.log('info', 'Tracking management changes');

    return [
      {
        date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        person: 'Jane Smith',
        position: 'Chief Technology Officer',
        type: 'joined',
        context: 'Previously VP Engineering at Major Tech Company',
        impact: 'Positive - brings enterprise scaling experience',
      },
    ];
  }

  private async monitorLitigation(_input: NewsSentimentInput): Promise<LegalIssue[]> {
    this.log('info', 'Monitoring litigation and legal issues');

    return [
      {
        date: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
        type: 'Patent Dispute',
        description: 'Patent infringement claim by competitor',
        status: 'active',
        severity: 'warning',
        potentialImpact: 'Low probability, could result in licensing fee',
      },
    ];
  }

  private async trackPartnerships(
    _input: NewsSentimentInput,
    _days: number
  ): Promise<Partnership[]> {
    this.log('info', 'Tracking partnerships and alliances');

    return [
      {
        date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        partner: 'Enterprise Software Leader',
        type: 'Technology Integration',
        description: 'Deep integration with leading CRM platform',
        strategicValue: 'Opens access to large enterprise customer base',
      },
    ];
  }

  private async gatherCustomerNews(
    _input: NewsSentimentInput,
    _days: number
  ): Promise<CustomerNews[]> {
    this.log('info', 'Gathering customer wins and losses');

    return [
      {
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        customer: 'Fortune 500 Company',
        type: 'win',
        description: 'Major enterprise customer signed',
        impact: 'Significant revenue opportunity and reference customer',
      },
      {
        date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        type: 'expansion',
        description: 'Existing customer expanded to additional departments',
        impact: 'Validates land-and-expand strategy',
      },
    ];
  }

  private async analyzeESG(_input: NewsSentimentInput): Promise<ESGAnalysis> {
    this.log('info', 'Analyzing ESG factors');

    return {
      environmentalScore: 7.5,
      socialScore: 8.2,
      governanceScore: 8.5,
      overallScore: 8.1,
      controversies: [],
      positiveInitiatives: [
        'Carbon neutral operations',
        'Diversity and inclusion program',
        'Strong board independence',
      ],
    };
  }

  private async analyzeSocialMedia(_input: NewsSentimentInput): Promise<SocialMediaSentiment> {
    this.log('info', 'Analyzing social media sentiment');

    return {
      overallSentiment: 0.65,
      trendingTopics: [
        'Product launch',
        'Customer success',
        'Company culture',
      ],
      volume: 1250,
      influencerMentions: 15,
    };
  }

  private async generateAlerts(
    _input: NewsSentimentInput,
    data: {
      keyEvents: NewsEvent[];
      managementChanges: ManagementChange[];
      litigation: LegalIssue[];
    }
  ): Promise<Alert[]> {
    this.log('info', 'Generating alerts');

    const alerts: Alert[] = [];

    // Check for critical litigation
    for (const legal of data.litigation) {
      if (legal.severity === 'critical' && legal.status === 'active') {
        alerts.push({
          type: 'critical',
          category: 'legal',
          message: `Critical litigation: ${legal.description}`,
          triggeredAt: new Date(),
          requiresAction: true,
        });
      }
    }

    // Check for negative sentiment spikes
    const recentNegative = data.keyEvents.filter(
      (e) => e.sentiment < -0.5 && e.impact === 'high'
    );
    if (recentNegative.length > 0) {
      alerts.push({
        type: 'warning',
        category: 'reputation',
        message: 'Negative sentiment spike detected in recent news',
        triggeredAt: new Date(),
        requiresAction: false,
      });
    }

    // Check for executive departures
    const departures = data.managementChanges.filter((m) => m.type === 'departed');
    if (departures.length > 2) {
      alerts.push({
        type: 'warning',
        category: 'management',
        message: `Multiple executive departures: ${departures.length}`,
        triggeredAt: new Date(),
        requiresAction: true,
      });
    }

    return alerts;
  }

  private calculateSentimentTrend(events: NewsEvent[]): { date: Date; score: number }[] {
    // Group events by week and calculate average sentiment
    const trend: { date: Date; score: number }[] = [];
    const now = Date.now();

    for (let week = 0; week < 12; week++) {
      const weekStart = now - (week + 1) * 7 * 24 * 60 * 60 * 1000;
      const weekEnd = now - week * 7 * 24 * 60 * 60 * 1000;

      const weekEvents = events.filter((e) => {
        const eventTime = e.date.getTime();
        return eventTime >= weekStart && eventTime < weekEnd;
      });

      const avgSentiment =
        weekEvents.length > 0
          ? weekEvents.reduce((sum, e) => sum + e.sentiment, 0) / weekEvents.length
          : 0;

      trend.unshift({
        date: new Date(weekStart),
        score: avgSentiment,
      });
    }

    return trend;
  }

  private calculateOverallSentiment(trend: { date: Date; score: number }[]): number {
    if (trend.length === 0) return 0;

    // Weight recent sentiment more heavily
    let weightedSum = 0;
    let totalWeight = 0;

    trend.forEach((point, index) => {
      const weight = index + 1; // More recent = higher weight
      weightedSum += point.score * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
}
