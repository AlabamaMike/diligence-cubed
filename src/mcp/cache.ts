/**
 * MCP Cache Layer
 * Redis-backed caching with TTL management
 */

import { createClient, RedisClientType } from 'redis';
import { CacheConfig, MCPResponse } from '../types/mcp';
import crypto from 'crypto';

export class MCPCache {
  private client: RedisClientType | null = null;
  private connected: boolean = false;
  private memoryCache: Map<string, { value: any; expiry: number }> = new Map();
  private readonly keyPrefix: string = 'mcp:';
  private readonly useMemoryFallback: boolean = true;

  constructor(
    private redisUrl?: string,
    private defaultTTL: number = 3600
  ) {}

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    if (this.redisUrl) {
      try {
        this.client = createClient({
          url: this.redisUrl,
        });

        this.client.on('error', (err) => {
          console.error('Redis Client Error:', err);
          this.connected = false;
        });

        this.client.on('connect', () => {
          console.log('Redis Client Connected');
          this.connected = true;
        });

        await this.client.connect();
      } catch (error) {
        console.error('Failed to connect to Redis:', error);
        console.log('Falling back to memory cache');
        this.connected = false;
      }
    } else {
      console.log('No Redis URL provided, using memory cache only');
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client && this.connected) {
      await this.client.quit();
      this.connected = false;
    }
  }

  /**
   * Generate cache key from request parameters
   */
  generateCacheKey(
    server: string,
    endpoint: string,
    params: Record<string, any>
  ): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, any>);

    const paramsString = JSON.stringify(sortedParams);
    const hash = crypto
      .createHash('sha256')
      .update(paramsString)
      .digest('hex')
      .substring(0, 16);

    return `${this.keyPrefix}${server}:${endpoint}:${hash}`;
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<MCPResponse<T> | null> {
    // Try memory cache first if Redis is not connected
    if (!this.connected && this.useMemoryFallback) {
      return this.getFromMemory<T>(key);
    }

    // Try Redis
    if (this.client && this.connected) {
      try {
        const value = await this.client.get(key);
        if (value) {
          const parsed = JSON.parse(value) as MCPResponse<T>;
          return {
            ...parsed,
            cached: true,
          };
        }
      } catch (error) {
        console.error('Redis get error:', error);
        // Fall back to memory cache
        if (this.useMemoryFallback) {
          return this.getFromMemory<T>(key);
        }
      }
    }

    return null;
  }

  /**
   * Set value in cache with TTL
   */
  async set<T = any>(
    key: string,
    value: MCPResponse<T>,
    ttl?: number
  ): Promise<void> {
    const cacheTTL = ttl || this.defaultTTL;

    // Set in memory cache as fallback
    if (this.useMemoryFallback) {
      this.setInMemory(key, value, cacheTTL);
    }

    // Set in Redis
    if (this.client && this.connected) {
      try {
        const serialized = JSON.stringify(value);
        await this.client.setEx(key, cacheTTL, serialized);
      } catch (error) {
        console.error('Redis set error:', error);
      }
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    // Delete from memory cache
    this.memoryCache.delete(key);

    // Delete from Redis
    if (this.client && this.connected) {
      try {
        await this.client.del(key);
      } catch (error) {
        console.error('Redis delete error:', error);
      }
    }
  }

  /**
   * Clear cache by pattern
   */
  async clearByPattern(pattern: string): Promise<number> {
    let deletedCount = 0;

    // Clear from memory cache
    const memoryKeys = Array.from(this.memoryCache.keys()).filter((key) =>
      key.includes(pattern)
    );
    memoryKeys.forEach((key) => this.memoryCache.delete(key));
    deletedCount += memoryKeys.length;

    // Clear from Redis
    if (this.client && this.connected) {
      try {
        const keys = await this.client.keys(`${this.keyPrefix}${pattern}*`);
        if (keys.length > 0) {
          deletedCount += await this.client.del(keys);
        }
      } catch (error) {
        console.error('Redis clearByPattern error:', error);
      }
    }

    return deletedCount;
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();

    // Clear Redis
    if (this.client && this.connected) {
      try {
        const keys = await this.client.keys(`${this.keyPrefix}*`);
        if (keys.length > 0) {
          await this.client.del(keys);
        }
      } catch (error) {
        console.error('Redis clearAll error:', error);
      }
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    redisConnected: boolean;
    memoryCacheSize: number;
    redisCacheSize?: number;
  }> {
    const stats = {
      redisConnected: this.connected,
      memoryCacheSize: this.memoryCache.size,
    };

    if (this.client && this.connected) {
      try {
        const keys = await this.client.keys(`${this.keyPrefix}*`);
        return {
          ...stats,
          redisCacheSize: keys.length,
        };
      } catch (error) {
        console.error('Redis getStats error:', error);
      }
    }

    return stats;
  }

  /**
   * Memory cache operations (fallback)
   */
  private getFromMemory<T = any>(key: string): MCPResponse<T> | null {
    const cached = this.memoryCache.get(key);
    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() > cached.expiry) {
      this.memoryCache.delete(key);
      return null;
    }

    return {
      ...cached.value,
      cached: true,
    };
  }

  private setInMemory<T = any>(
    key: string,
    value: MCPResponse<T>,
    ttl: number
  ): void {
    const expiry = Date.now() + ttl * 1000;
    this.memoryCache.set(key, { value, expiry });

    // Clean up expired entries periodically
    if (this.memoryCache.size > 1000) {
      this.cleanupMemoryCache();
    }
  }

  private cleanupMemoryCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.memoryCache.forEach((value, key) => {
      if (now > value.expiry) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.memoryCache.delete(key));
  }

  /**
   * Check if cache is healthy
   */
  async healthCheck(): Promise<boolean> {
    if (!this.connected || !this.client) {
      return this.useMemoryFallback; // Healthy if we can use memory fallback
    }

    try {
      await this.client.ping();
      return true;
    } catch (error) {
      return false;
    }
  }
}
