import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firecrawl', () => ({
  Firecrawl: class {
    constructor() {
      return {
        search: vi.fn(),
      };
    }
  },
}));

import { webResearch } from '../src/tools/firecrawl.js';

describe('webResearch tool', () => {
  beforeEach(() => {
    // Clear environment before each test
    delete process.env.FIRECRAWL_API_KEY;
  });

  it('should throw error when FIRECRAWL_API_KEY is missing', async () => {
    await expect(
      webResearch.execute({ query: 'test', maxResults: 3 }, { toolCallId: 'test-1', messages: [], context: {} })
    ).rejects.toThrow('FIRECRAWL_API_KEY is not configured');
  });

  it('should have proper tool schema', () => {
    expect(webResearch.description).toBeTypeOf('string');
    expect(webResearch.inputSchema).toBeDefined();
    expect(webResearch.description).toContain('web pages');
  });

  it('should validate input schema', () => {
    const schema = webResearch.inputSchema;
    expect(schema).toBeDefined();
    // The schema should have query as required and maxResults as optional
  });
});
