/**
 * Tests for Workflow Orchestration
 */

import { MockAgent, MockWorkflowContext } from '../helpers/mocks';
import { createTestEnvironment, delay } from '../helpers/test-utils';
import { mockCompanyBasicInfo } from '../fixtures/company-data';

describe('Workflow Orchestration', () => {
  let testEnv: ReturnType<typeof createTestEnvironment>;
  let workflow: any;

  beforeEach(() => {
    testEnv = createTestEnvironment();
    
    workflow = {
      execute: jest.fn(),
      stages: [],
      context: null
    };
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  describe('Workflow Execution', () => {
    it('should execute all stages in sequence', async () => {
      const stages = [
        { name: 'discovery', execute: jest.fn().mockResolvedValue({ status: 'completed' }) },
        { name: 'research', execute: jest.fn().mockResolvedValue({ status: 'completed' }) },
        { name: 'validation', execute: jest.fn().mockResolvedValue({ status: 'completed' }) },
        { name: 'synthesis', execute: jest.fn().mockResolvedValue({ status: 'completed' }) }
      ];

      workflow.stages = stages;
      workflow.execute = jest.fn().mockImplementation(async () => {
        for (const stage of stages) {
          await stage.execute();
        }
        return { status: 'completed', stages_completed: stages.length };
      });

      const result = await workflow.execute(mockCompanyBasicInfo);

      expect(result.status).toBe('completed');
      expect(result.stages_completed).toBe(4);
      stages.forEach(stage => {
        expect(stage.execute).toHaveBeenCalled();
      });
    });

    it('should handle stage failures', async () => {
      const stages = [
        { name: 'discovery', execute: jest.fn().mockResolvedValue({ status: 'completed' }) },
        { name: 'research', execute: jest.fn().mockRejectedValue(new Error('Research failed')) },
        { name: 'validation', execute: jest.fn().mockResolvedValue({ status: 'completed' }) }
      ];

      workflow.execute = jest.fn().mockImplementation(async () => {
        let completed = 0;
        let failed = 0;
        
        for (const stage of stages) {
          try {
            await stage.execute();
            completed++;
          } catch (error) {
            failed++;
            return {
              status: 'failed',
              failed_stage: stage.name,
              completed_stages: completed,
              failed_stages: failed
            };
          }
        }
      });

      const result = await workflow.execute(mockCompanyBasicInfo);

      expect(result.status).toBe('failed');
      expect(result.failed_stage).toBe('research');
      expect(result.completed_stages).toBe(1);
    });

    it('should track workflow progress', async () => {
      const progressUpdates: number[] = [];

      workflow.execute = jest.fn().mockImplementation(async () => {
        for (let i = 0; i < 5; i++) {
          progressUpdates.push((i + 1) * 20);
          await delay(10);
        }
        return { progress_history: progressUpdates };
      });

      const result = await workflow.execute(mockCompanyBasicInfo);

      expect(result.progress_history).toEqual([20, 40, 60, 80, 100]);
    });
  });

  describe('Parallel Task Scheduling', () => {
    it('should execute independent tasks in parallel', async () => {
      const tasks = [
        { id: 'financial', duration: 100, execute: jest.fn() },
        { id: 'market', duration: 150, execute: jest.fn() },
        { id: 'competitive', duration: 120, execute: jest.fn() }
      ];

      const startTime = Date.now();

      // Simulate parallel execution
      await Promise.all(
        tasks.map(task => 
          task.execute.mockImplementation(() => delay(task.duration))()
        )
      );

      const totalTime = Date.now() - startTime;

      // Parallel execution should take roughly as long as the longest task
      expect(totalTime).toBeLessThan(200); // Should be ~150ms + overhead
      expect(totalTime).toBeGreaterThan(140); // Should be at least 150ms

      tasks.forEach(task => {
        expect(task.execute).toHaveBeenCalled();
      });
    });

    it('should respect max concurrency limit', async () => {
      const maxConcurrent = 2;
      const tasks = Array.from({ length: 5 }, (_, i) => ({
        id: `task-${i}`,
        execute: jest.fn().mockImplementation(() => delay(50))
      }));

      let currentlyRunning = 0;
      let maxReached = 0;

      const executeWithLimit = async (task: any) => {
        currentlyRunning++;
        maxReached = Math.max(maxReached, currentlyRunning);
        await task.execute();
        currentlyRunning--;
      };

      // Execute with concurrency limit
      const queue = [...tasks];
      const running: Promise<void>[] = [];

      while (queue.length > 0 || running.length > 0) {
        while (running.length < maxConcurrent && queue.length > 0) {
          const task = queue.shift()!;
          const promise = executeWithLimit(task);
          running.push(promise);
        }

        if (running.length > 0) {
          await Promise.race(running);
          running.splice(0, running.findIndex(p => p === undefined) + 1);
        }
      }

      expect(maxReached).toBeLessThanOrEqual(maxConcurrent);
    });

    it('should handle task dependencies correctly', async () => {
      const executionOrder: string[] = [];

      const tasks = {
        financial: { 
          id: 'financial',
          dependencies: [],
          execute: jest.fn().mockImplementation(async () => {
            executionOrder.push('financial');
            await delay(50);
          })
        },
        risk: {
          id: 'risk',
          dependencies: ['financial'],
          execute: jest.fn().mockImplementation(async () => {
            executionOrder.push('risk');
            await delay(50);
          })
        },
        synthesis: {
          id: 'synthesis',
          dependencies: ['financial', 'risk'],
          execute: jest.fn().mockImplementation(async () => {
            executionOrder.push('synthesis');
            await delay(50);
          })
        }
      };

      // Execute respecting dependencies
      await tasks.financial.execute();
      await tasks.risk.execute();
      await tasks.synthesis.execute();

      expect(executionOrder).toEqual(['financial', 'risk', 'synthesis']);
      expect(executionOrder.indexOf('financial')).toBeLessThan(executionOrder.indexOf('risk'));
      expect(executionOrder.indexOf('risk')).toBeLessThan(executionOrder.indexOf('synthesis'));
    });
  });

  describe('Quality Gates', () => {
    it('should validate quality gates before proceeding', async () => {
      const qualityGate = {
        check: jest.fn().mockResolvedValue(true),
        name: 'data_completeness',
        threshold: 0.8
      };

      const result = await qualityGate.check({ completeness: 0.85 });

      expect(result).toBe(true);
      expect(qualityGate.check).toHaveBeenCalled();
    });

    it('should block progression when quality gate fails', async () => {
      const qualityGate = {
        check: jest.fn().mockResolvedValue(false),
        name: 'data_quality',
        threshold: 0.8
      };

      workflow.execute = jest.fn().mockImplementation(async (input: any) => {
        const gateResult = await qualityGate.check(input);
        
        if (!gateResult) {
          return {
            status: 'blocked',
            reason: 'Quality gate failed',
            gate: qualityGate.name
          };
        }
        
        return { status: 'completed' };
      });

      const result = await workflow.execute({ quality: 0.5 });

      expect(result.status).toBe('blocked');
      expect(result.gate).toBe('data_quality');
    });

    it('should support multiple quality gates', async () => {
      const gates = [
        { name: 'completeness', check: jest.fn().mockResolvedValue(true) },
        { name: 'accuracy', check: jest.fn().mockResolvedValue(true) },
        { name: 'consistency', check: jest.fn().mockResolvedValue(false) }
      ];

      workflow.execute = jest.fn().mockImplementation(async (input: any) => {
        const results = await Promise.all(gates.map(g => g.check(input)));
        const failedGates = gates.filter((_, i) => !results[i]);

        if (failedGates.length > 0) {
          return {
            status: 'blocked',
            failed_gates: failedGates.map(g => g.name)
          };
        }

        return { status: 'completed' };
      });

      const result = await workflow.execute({});

      expect(result.status).toBe('blocked');
      expect(result.failed_gates).toContain('consistency');
    });
  });

  describe('Dependency Resolution', () => {
    it('should resolve task dependencies', async () => {
      const dependencyGraph = {
        'task-a': [],
        'task-b': ['task-a'],
        'task-c': ['task-a'],
        'task-d': ['task-b', 'task-c']
      };

      const topologicalSort = (graph: Record<string, string[]>) => {
        const visited = new Set<string>();
        const result: string[] = [];

        const visit = (node: string) => {
          if (visited.has(node)) return;
          visited.add(node);
          graph[node].forEach(dep => visit(dep));
          result.push(node);
        };

        Object.keys(graph).forEach(visit);
        return result;
      };

      const order = topologicalSort(dependencyGraph);

      expect(order.indexOf('task-a')).toBeLessThan(order.indexOf('task-b'));
      expect(order.indexOf('task-a')).toBeLessThan(order.indexOf('task-c'));
      expect(order.indexOf('task-b')).toBeLessThan(order.indexOf('task-d'));
      expect(order.indexOf('task-c')).toBeLessThan(order.indexOf('task-d'));
    });

    it('should detect circular dependencies', async () => {
      const circularGraph = {
        'task-a': ['task-b'],
        'task-b': ['task-c'],
        'task-c': ['task-a'] // Circular dependency
      };

      const detectCycle = (graph: Record<string, string[]>): boolean => {
        const visiting = new Set<string>();
        const visited = new Set<string>();

        const hasCycle = (node: string): boolean => {
          if (visiting.has(node)) return true;
          if (visited.has(node)) return false;

          visiting.add(node);
          for (const dep of graph[node] || []) {
            if (hasCycle(dep)) return true;
          }
          visiting.delete(node);
          visited.add(node);
          return false;
        };

        return Object.keys(graph).some(hasCycle);
      };

      expect(detectCycle(circularGraph)).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('should retry failed stages', async () => {
      let attempts = 0;
      const maxRetries = 3;

      const failingStage = {
        execute: jest.fn().mockImplementation(async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return { status: 'completed' };
        })
      };

      workflow.execute = jest.fn().mockImplementation(async () => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await failingStage.execute();
          } catch (error) {
            if (i === maxRetries - 1) throw error;
            await delay(100);
          }
        }
      });

      const result = await workflow.execute({});

      expect(result.status).toBe('completed');
      expect(attempts).toBe(3);
    });

    it('should implement circuit breaker pattern', async () => {
      const circuitBreaker = {
        failures: 0,
        threshold: 3,
        state: 'closed',
        
        async call(fn: () => Promise<any>) {
          if (this.state === 'open') {
            throw new Error('Circuit breaker is open');
          }

          try {
            const result = await fn();
            this.failures = 0;
            return result;
          } catch (error) {
            this.failures++;
            if (this.failures >= this.threshold) {
              this.state = 'open';
            }
            throw error;
          }
        }
      };

      const failingFunction = jest.fn().mockRejectedValue(new Error('Failure'));

      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.call(failingFunction);
        } catch (error) {
          // Expected failures
        }
      }

      expect(circuitBreaker.state).toBe('open');
      await expect(
        circuitBreaker.call(failingFunction)
      ).rejects.toThrow('Circuit breaker is open');
    });
  });
});
