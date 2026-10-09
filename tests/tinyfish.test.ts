import { describe, it, expect, vi, beforeEach } from 'vitest';

const runMock = vi.hoisted(() => vi.fn());

vi.mock('@tiny-fish/sdk', () => ({
  TinyFish: class {
    agent = {
      run: runMock,
    };
  },
}));

import { executeWebAgent, normalizeTinyFishResult, webAgent } from '../src/tools/tinyfish.js';

describe('webAgent tool', () => {
  beforeEach(() => {
    delete process.env.TINYFISH_API_KEY;
    runMock.mockReset();
  });

  it('should describe itself as a live browser action tool', () => {
    expect(webAgent.description).toContain('real browser/web actions');
    expect(webAgent.description).toContain('Do not use it for ordinary web research');
    expect(webAgent.inputSchema).toBeDefined();
  });

  it('should return a structured failure when TINYFISH_API_KEY is missing', async () => {
    const result = await executeWebAgent({
      goal: 'Open https://www.tinyfish.ai and summarize the homepage',
      url: 'https://www.tinyfish.ai',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('TINYFISH_API_KEY');
    }
    expect(runMock).not.toHaveBeenCalled();
  });

  it('should fail cleanly when no URL is available', async () => {
    process.env.TINYFISH_API_KEY = 'test-key';

    const result = await executeWebAgent({
      goal: 'Click around until you find pricing',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('URL');
    }
    expect(runMock).not.toHaveBeenCalled();
  });

  it('should extract a URL from the goal and normalize a successful TinyFish run', async () => {
    process.env.TINYFISH_API_KEY = 'test-key';

    runMock.mockResolvedValue({
      status: 'COMPLETED',
      result: {
        summary: 'TinyFish builds web agents that automate live websites.',
        homepage: 'https://www.tinyfish.ai',
      },
      error: null,
    });

    const result = await executeWebAgent({
      goal: 'Go to https://www.tinyfish.ai and tell me what the website is about.',
    });

    expect(runMock).toHaveBeenCalledWith({
      goal: 'Go to https://www.tinyfish.ai and tell me what the website is about.',
      url: 'https://www.tinyfish.ai',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.result).toContain('TinyFish builds web agents');
      expect(result.sources).toContain('https://www.tinyfish.ai');
    }
  });

  it('should not report success when TinyFish returns a failed run', async () => {
    process.env.TINYFISH_API_KEY = 'test-key';

    runMock.mockResolvedValue({
      status: 'FAILED',
      result: null,
      error: { message: 'The page blocked automation.' },
    });

    const result = await executeWebAgent({
      goal: 'Open the NVIDIA site and extract RTX 5090 specs',
      url: 'https://www.nvidia.com',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('blocked automation');
    }
  });

  it('should never expose API keys in error messages', async () => {
    process.env.TINYFISH_API_KEY = 'super-secret-tinyfish-key';

    runMock.mockRejectedValue(
      new Error('Request failed with key super-secret-tinyfish-key')
    );

    const result = await executeWebAgent({
      goal: 'Inspect the homepage',
      url: 'https://example.com',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).not.toContain('super-secret-tinyfish-key');
    }
  });
});

describe('normalizeTinyFishResult', () => {
  it('truncates enormous browser output', () => {
    const result = normalizeTinyFishResult({
      goal: 'extract',
      url: 'https://example.com',
      status: 'COMPLETED',
      result: 'x'.repeat(12_000),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.result.length).toBeLessThan(12_000);
      expect(result.result.endsWith('...')).toBe(true);
    }
  });
});
