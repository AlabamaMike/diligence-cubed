/**
 * Configuration management for the platform
 */

import * as dotenv from 'dotenv';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

export interface PlatformConfig {
  // Anthropic Configuration
  anthropic: {
    apiKey: string;
  };

  // MCP Server Configuration
  mcp: {
    alphavantage: {
      apiKey: string;
      rateLimit: number;
    };
    polygon: {
      apiKey: string;
    };
    exa: {
      apiKey: string;
      rateLimit: number;
    };
    perplexity: {
      apiKey: string;
    };
    github: {
      token: string;
      rateLimit: number;
    };
    newsapi: {
      apiKey: string;
    };
  };

  // Database Configuration
  database: {
    url: string;
  };

  // Redis Configuration
  redis: {
    url: string;
  };

  // Application Configuration
  app: {
    nodeEnv: string;
    port: number;
    logLevel: string;
  };

  // Cache Configuration
  cache: {
    ttlSeconds: number;
    maxSizeMB: number;
  };

  // Feature Flags
  features: {
    adaptiveDepth: boolean;
    selfImprovement: boolean;
    realTimeMonitoring: boolean;
  };
}

function validateConfig(): void {
  const required = ['ANTHROPIC_API_KEY'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

function loadConfig(): PlatformConfig {
  validateConfig();

  return {
    anthropic: {
      apiKey: process.env['ANTHROPIC_API_KEY'] || '',
    },
    mcp: {
      alphavantage: {
        apiKey: process.env['ALPHAVANTAGE_API_KEY'] || '',
        rateLimit: parseInt(process.env['ALPHAVANTAGE_RATE_LIMIT'] || '500', 10),
      },
      polygon: {
        apiKey: process.env['POLYGON_API_KEY'] || '',
      },
      exa: {
        apiKey: process.env['EXA_API_KEY'] || '',
        rateLimit: parseInt(process.env['EXA_RATE_LIMIT'] || '1000', 10),
      },
      perplexity: {
        apiKey: process.env['PERPLEXITY_API_KEY'] || '',
      },
      github: {
        token: process.env['GITHUB_TOKEN'] || '',
        rateLimit: parseInt(process.env['GITHUB_RATE_LIMIT'] || '5000', 10),
      },
      newsapi: {
        apiKey: process.env['NEWS_API_KEY'] || '',
      },
    },
    database: {
      url: process.env['DATABASE_URL'] || 'postgresql://localhost:5432/diligence_platform',
    },
    redis: {
      url: process.env['REDIS_URL'] || 'redis://localhost:6379',
    },
    app: {
      nodeEnv: process.env['NODE_ENV'] || 'development',
      port: parseInt(process.env['PORT'] || '3000', 10),
      logLevel: process.env['LOG_LEVEL'] || 'info',
    },
    cache: {
      ttlSeconds: parseInt(process.env['CACHE_TTL_SECONDS'] || '3600', 10),
      maxSizeMB: parseInt(process.env['CACHE_MAX_SIZE_MB'] || '1024', 10),
    },
    features: {
      adaptiveDepth: process.env['ENABLE_ADAPTIVE_DEPTH'] === 'true',
      selfImprovement: process.env['ENABLE_SELF_IMPROVEMENT'] === 'true',
      realTimeMonitoring: process.env['ENABLE_REAL_TIME_MONITORING'] === 'true',
    },
  };
}

export const config = loadConfig();

export default config;
