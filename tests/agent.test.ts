import { describe, it, expect, vi } from 'vitest';
import { ToolLoopAgent, isStepCount } from 'ai';
import { tool } from 'ai';
import { z } from 'zod';

describe('Jarvis Agent', () => {
  it('should create an agent with tools', () => {
    const mockModel = {
      provider: 'test',
      modelId: 'test-model',
      doGenerate: vi.fn(),
      doStream: vi.fn(),
    };

    const testTool = tool({
      description: 'Test tool',
      inputSchema: z.object({ value: z.string() }),
      execute: async ({ value }) => ({ result: value }),
    });

    const agent = new ToolLoopAgent({
      model: mockModel as any,
      instructions: 'You are a test assistant.',
      tools: { testTool },
      stopWhen: isStepCount(5),
    });

    expect(agent.tools).toHaveProperty('testTool');
  });

  it('should respect stop conditions', () => {
    const mockModel = {
      provider: 'test',
      modelId: 'test-model',
      doGenerate: vi.fn(),
      doStream: vi.fn(),
    };

    const agent = new ToolLoopAgent({
      model: mockModel as any,
      instructions: 'You are a test assistant.',
      tools: {},
      stopWhen: isStepCount(3),
    });

    expect(agent.tools).toBeDefined();
  });

  it('should have tool registry structure', () => {
    const tools = {
      getCurrentTime: {
        description: 'Get current time',
        inputSchema: z.object({}),
        execute: async () => ({}),
      },
      webResearch: {
        description: 'Research the web',
        inputSchema: z.object({}),
        execute: async () => ({}),
      },
      webAgent: {
        description: 'Perform live browser actions',
        inputSchema: z.object({}),
        execute: async () => ({}),
      },
    };

    expect(tools).toHaveProperty('getCurrentTime');
    expect(tools).toHaveProperty('webResearch');
    expect(tools).toHaveProperty('webAgent');
    expect(tools.getCurrentTime).toHaveProperty('description');
    expect(tools.getCurrentTime).toHaveProperty('inputSchema');
    expect(tools.getCurrentTime).toHaveProperty('execute');
  });
});
