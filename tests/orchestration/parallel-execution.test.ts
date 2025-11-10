/**
 * Tests for Parallel Execution and Task Scheduling
 */

import { delay } from '../helpers/test-utils';

describe('Parallel Execution', () => {
  describe('Task Scheduler', () => {
    it('should schedule tasks efficiently', async () => {
      const tasks = [
        { id: 1, priority: 'high', duration: 50 },
        { id: 2, priority: 'low', duration: 30 },
        { id: 3, priority: 'high', duration: 40 }
      ];

      const scheduler = {
        schedule: jest.fn((tasks: any[]) => {
          return tasks.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority as keyof typeof priorityOrder] - 
                   priorityOrder[b.priority as keyof typeof priorityOrder];
          });
        })
      };

      const scheduled = scheduler.schedule(tasks);

      expect(scheduled[0].priority).toBe('high');
      expect(scheduled[scheduled.length - 1].priority).toBe('low');
    });

    it('should handle task cancellation', async () => {
      const controller = new AbortController();
      const task = jest.fn().mockImplementation(async (signal: AbortSignal) => {
        for (let i = 0; i < 10; i++) {
          if (signal.aborted) {
            throw new Error('Task cancelled');
          }
          await delay(10);
        }
      });

      const taskPromise = task(controller.signal);
      
      setTimeout(() => controller.abort(), 30);

      await expect(taskPromise).rejects.toThrow('Task cancelled');
    });

    it('should balance load across workers', async () => {
      const workers = [
        { id: 'worker-1', load: 0 },
        { id: 'worker-2', load: 0 },
        { id: 'worker-3', load: 0 }
      ];

      const assignTask = (workers: any[], taskLoad: number) => {
        const worker = workers.reduce((min, w) => 
          w.load < min.load ? w : min
        );
        worker.load += taskLoad;
        return worker;
      };

      assignTask(workers, 10);
      assignTask(workers, 15);
      assignTask(workers, 10);

      const totalLoad = workers.reduce((sum, w) => sum + w.load, 0);
      const avgLoad = totalLoad / workers.length;
      
      workers.forEach(worker => {
        expect(Math.abs(worker.load - avgLoad)).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('Resource Management', () => {
    it('should manage memory constraints', async () => {
      const memoryLimit = 1000; // MB
      const tasks = [
        { id: 1, memoryRequired: 300 },
        { id: 2, memoryRequired: 400 },
        { id: 3, memoryRequired: 500 }
      ];

      let currentMemory = 0;
      const runningTasks: any[] = [];

      const canRunTask = (task: any) => {
        return currentMemory + task.memoryRequired <= memoryLimit;
      };

      // Task 1 and 2 can run together (700MB)
      expect(canRunTask(tasks[0])).toBe(true);
      currentMemory += tasks[0].memoryRequired;
      
      expect(canRunTask(tasks[1])).toBe(true);
      currentMemory += tasks[1].memoryRequired;
      
      // Task 3 cannot run with 1 and 2 (would be 1200MB)
      expect(canRunTask(tasks[2])).toBe(false);
    });
  });
});
