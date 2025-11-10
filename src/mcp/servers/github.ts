/**
 * GitHub MCP Server Client
 * Code analysis and repository metrics
 */

import axios, { AxiosInstance } from 'axios';
import {
  GitHubConfig,
  GitHubRepoParams,
  GitHubRepoInfo,
  GitHubCodeQualityMetrics,
  MCPResponse,
} from '../../types/mcp';
import { MCPErrorHandler } from '../error-handler';

export class GitHubClient {
  private client: AxiosInstance;
  private errorHandler: MCPErrorHandler;
  private readonly baseUrl = 'https://api.github.com';

  constructor(private config: GitHubConfig) {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Diligence-Platform',
      },
    });

    this.errorHandler = new MCPErrorHandler();
  }

  /**
   * Get repository information
   */
  async getRepository(params: GitHubRepoParams): Promise<MCPResponse<GitHubRepoInfo>> {
    const requestId = this.generateRequestId();

    try {
      const response = await this.client.get(`/repos/${params.owner}/${params.repo}`);

      const data: GitHubRepoInfo = {
        id: response.data.id,
        name: response.data.name,
        fullName: response.data.full_name,
        description: response.data.description,
        language: response.data.language,
        stars: response.data.stargazers_count,
        forks: response.data.forks_count,
        openIssues: response.data.open_issues_count,
        watchers: response.data.watchers_count,
        createdAt: response.data.created_at,
        updatedAt: response.data.updated_at,
        pushedAt: response.data.pushed_at,
        size: response.data.size,
        license: response.data.license
          ? {
              key: response.data.license.key,
              name: response.data.license.name,
            }
          : undefined,
        topics: response.data.topics || [],
      };

      return {
        success: true,
        data,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'github',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'github');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'github',
      };
    }
  }

  /**
   * Get code quality metrics
   */
  async getCodeQualityMetrics(
    params: GitHubRepoParams
  ): Promise<MCPResponse<GitHubCodeQualityMetrics>> {
    const requestId = this.generateRequestId();

    try {
      // Fetch multiple endpoints in parallel
      const [commits, contributors, pullRequests, codeFrequency, languages] =
        await Promise.allSettled([
          this.client.get(`/repos/${params.owner}/${params.repo}/commits`, {
            params: { per_page: 100 },
          }),
          this.client.get(`/repos/${params.owner}/${params.repo}/contributors`),
          this.client.get(`/repos/${params.owner}/${params.repo}/pulls`, {
            params: { state: 'all', per_page: 100 },
          }),
          this.client.get(
            `/repos/${params.owner}/${params.repo}/stats/code_frequency`
          ),
          this.client.get(`/repos/${params.owner}/${params.repo}/languages`),
        ]);

      // Process commits
      const commitData =
        commits.status === 'fulfilled' ? commits.value.data : [];
      const totalCommits = commitData.length;

      // Calculate commits per week (last 12 weeks)
      const twelveWeeksAgo = new Date();
      twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
      const recentCommits = commitData.filter((commit: any) => {
        const commitDate = new Date(commit.commit.author.date);
        return commitDate > twelveWeeksAgo;
      });
      const avgCommitsPerWeek = recentCommits.length / 12;

      // Process contributors
      const contributorData =
        contributors.status === 'fulfilled' ? contributors.value.data : [];
      const contributorCount = contributorData.length;

      // Process pull requests
      const prData =
        pullRequests.status === 'fulfilled' ? pullRequests.value.data : [];
      const openPRs = prData.filter((pr: any) => pr.state === 'open').length;
      const closedPRs = prData.filter((pr: any) => pr.state === 'closed')
        .length;
      const mergedPRs = prData.filter((pr: any) => pr.merged_at).length;

      // Process code frequency
      const codeFreqData =
        codeFrequency.status === 'fulfilled'
          ? codeFrequency.value.data
          : [];
      let totalAdditions = 0;
      let totalDeletions = 0;
      codeFreqData.forEach((week: any[]) => {
        totalAdditions += Math.abs(week[1] || 0);
        totalDeletions += Math.abs(week[2] || 0);
      });

      // Process languages
      const languageData =
        languages.status === 'fulfilled' ? languages.value.data : {};

      const metrics: GitHubCodeQualityMetrics = {
        totalCommits,
        contributors: contributorCount,
        avgCommitsPerWeek,
        openIssuesCount: 0, // Will be set from repo info
        closedIssuesCount: 0, // Would need additional API call
        pullRequests: {
          open: openPRs,
          closed: closedPRs,
          merged: mergedPRs,
        },
        codeFrequency: {
          additions: totalAdditions,
          deletions: totalDeletions,
        },
        languages: languageData,
      };

      return {
        success: true,
        data: metrics,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'github',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'github');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'github',
      };
    }
  }

  /**
   * Search for organization repositories
   */
  async getOrganizationRepos(org: string): Promise<MCPResponse> {
    const requestId = this.generateRequestId();

    try {
      const response = await this.client.get(`/orgs/${org}/repos`, {
        params: {
          type: 'all',
          sort: 'updated',
          per_page: 100,
        },
      });

      const repos = response.data.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        language: repo.language,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        openIssues: repo.open_issues_count,
        watchers: repo.watchers_count,
        createdAt: repo.created_at,
        updatedAt: repo.updated_at,
        pushedAt: repo.pushed_at,
      }));

      return {
        success: true,
        data: repos,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'github',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'github');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'github',
      };
    }
  }

  /**
   * Get organization information
   */
  async getOrganization(org: string): Promise<MCPResponse> {
    const requestId = this.generateRequestId();

    try {
      const response = await this.client.get(`/orgs/${org}`);

      return {
        success: true,
        data: response.data,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'github',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'github');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'github',
      };
    }
  }

  /**
   * Get repository contributors
   */
  async getContributors(params: GitHubRepoParams): Promise<MCPResponse> {
    const requestId = this.generateRequestId();

    try {
      const response = await this.client.get(
        `/repos/${params.owner}/${params.repo}/contributors`
      );

      return {
        success: true,
        data: response.data,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'github',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'github');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'github',
      };
    }
  }

  /**
   * Get repository issues
   */
  async getIssues(
    params: GitHubRepoParams,
    state: 'open' | 'closed' | 'all' = 'all'
  ): Promise<MCPResponse> {
    const requestId = this.generateRequestId();

    try {
      const response = await this.client.get(
        `/repos/${params.owner}/${params.repo}/issues`,
        {
          params: {
            state,
            per_page: 100,
          },
        }
      );

      return {
        success: true,
        data: response.data,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'github',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'github');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'github',
      };
    }
  }

  /**
   * Get comprehensive analysis for a repository
   */
  async analyzeRepository(params: GitHubRepoParams): Promise<MCPResponse> {
    const requestId = this.generateRequestId();

    try {
      const [repoInfo, metrics, contributors, issues] = await Promise.allSettled([
        this.getRepository(params),
        this.getCodeQualityMetrics(params),
        this.getContributors(params),
        this.getIssues(params),
      ]);

      const data = {
        repository: repoInfo.status === 'fulfilled' ? repoInfo.value.data : null,
        metrics: metrics.status === 'fulfilled' ? metrics.value.data : null,
        contributors:
          contributors.status === 'fulfilled' ? contributors.value.data : null,
        issues: issues.status === 'fulfilled' ? issues.value.data : null,
      };

      return {
        success: true,
        data,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'github',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'github');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'github',
      };
    }
  }

  /**
   * Analyze organization
   */
  async analyzeOrganization(org: string): Promise<MCPResponse> {
    const requestId = this.generateRequestId();

    try {
      const [orgInfo, repos] = await Promise.allSettled([
        this.getOrganization(org),
        this.getOrganizationRepos(org),
      ]);

      // Analyze top repositories
      const topRepos =
        repos.status === 'fulfilled'
          ? repos.value.data.slice(0, 10)
          : [];

      const data = {
        organization: orgInfo.status === 'fulfilled' ? orgInfo.value.data : null,
        repositories: repos.status === 'fulfilled' ? repos.value.data : null,
        topRepositories: topRepos,
        metrics: {
          totalRepos: repos.status === 'fulfilled' ? repos.value.data.length : 0,
          totalStars:
            repos.status === 'fulfilled'
              ? repos.value.data.reduce((sum: number, repo: any) => sum + repo.stars, 0)
              : 0,
          totalForks:
            repos.status === 'fulfilled'
              ? repos.value.data.reduce((sum: number, repo: any) => sum + repo.forks, 0)
              : 0,
        },
      };

      return {
        success: true,
        data,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'github',
      };
    } catch (error) {
      const mcpError = this.errorHandler.createError(error, 'github');
      return {
        success: false,
        error: mcpError,
        cached: false,
        timestamp: new Date(),
        requestId,
        source: 'github',
      };
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `github_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/rate_limit');
      return true;
    } catch (error) {
      return false;
    }
  }
}
