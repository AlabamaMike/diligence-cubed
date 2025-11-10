/**
 * Unit Tests for Utility Functions
 */

describe('Utility Functions', () => {
  describe('Data Validation', () => {
    it('should validate revenue data', () => {
      const validateRevenue = (revenue: number) => {
        if (revenue < 0) return { valid: false, error: 'Revenue cannot be negative' };
        if (revenue > 1000000000000) return { valid: false, error: 'Revenue unrealistically high' };
        return { valid: true };
      };

      expect(validateRevenue(25000000).valid).toBe(true);
      expect(validateRevenue(-1000).valid).toBe(false);
      expect(validateRevenue(2000000000000).valid).toBe(false);
    });

    it('should validate growth rates', () => {
      const validateGrowthRate = (rate: number) => {
        if (rate < -1) return { valid: false, error: 'Growth rate cannot be less than -100%' };
        if (rate > 10) return { valid: false, error: 'Growth rate suspiciously high' };
        return { valid: true, needsVerification: rate > 2 };
      };

      expect(validateGrowthRate(0.45).valid).toBe(true);
      expect(validateGrowthRate(3.5).needsVerification).toBe(true);
      expect(validateGrowthRate(-1.5).valid).toBe(false);
    });

    it('should validate confidence scores', () => {
      const validateConfidence = (score: number) => {
        return score >= 0 && score <= 1;
      };

      expect(validateConfidence(0.85)).toBe(true);
      expect(validateConfidence(-0.1)).toBe(false);
      expect(validateConfidence(1.5)).toBe(false);
    });
  });

  describe('Data Transformation', () => {
    it('should calculate percentage change', () => {
      const calculateChange = (current: number, previous: number) => {
        return (current - previous) / previous;
      };

      expect(calculateChange(25000000, 18000000)).toBeCloseTo(0.389, 3);
      expect(calculateChange(100, 80)).toBeCloseTo(0.25, 2);
    });

    it('should format currency values', () => {
      const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(value);
      };

      expect(formatCurrency(25000000)).toBe('$25,000,000');
      expect(formatCurrency(1500.50)).toBe('$1,501');
    });

    it('should calculate moving average', () => {
      const calculateMovingAverage = (data: number[], window: number) => {
        const result: number[] = [];
        for (let i = window - 1; i < data.length; i++) {
          const sum = data.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
          result.push(sum / window);
        }
        return result;
      };

      const data = [10, 20, 30, 40, 50];
      const ma = calculateMovingAverage(data, 3);

      expect(ma[0]).toBeCloseTo(20, 1);
      expect(ma[1]).toBeCloseTo(30, 1);
      expect(ma[2]).toBeCloseTo(40, 1);
    });
  });

  describe('Statistical Functions', () => {
    it('should calculate mean', () => {
      const mean = (data: number[]) => {
        return data.reduce((a, b) => a + b, 0) / data.length;
      };

      expect(mean([10, 20, 30, 40, 50])).toBe(30);
      expect(mean([5, 15, 25])).toBeCloseTo(15, 1);
    });

    it('should calculate median', () => {
      const median = (data: number[]) => {
        const sorted = [...data].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 
          ? (sorted[mid - 1] + sorted[mid]) / 2 
          : sorted[mid];
      };

      expect(median([10, 20, 30, 40, 50])).toBe(30);
      expect(median([10, 20, 30, 40])).toBe(25);
    });
  });

  describe('Error Handling Utilities', () => {
    it('should create error with context', () => {
      class CustomError extends Error {
        constructor(
          message: string,
          public code: string,
          public context?: any
        ) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const error = new CustomError('Validation failed', 'VALIDATION_ERROR', { field: 'revenue' });

      expect(error.message).toBe('Validation failed');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.context.field).toBe('revenue');
    });
  });
});
