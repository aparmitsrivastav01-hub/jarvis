import { describe, it, expect, vi, beforeEach } from 'vitest';

const searchMock = vi.hoisted(() => vi.fn());

vi.mock('firecrawl', () => ({
  Firecrawl: class {
    search = searchMock;
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

  it('should still return normalized Firecrawl research results', async () => {
    process.env.FIRECRAWL_API_KEY = 'firecrawl-test-key';
    searchMock.mockResolvedValue({
      web: [
        {
          title: 'Firecrawl',
          url: 'https://www.firecrawl.dev',
          description: 'Web data API for AI agents',
          markdown: 'Firecrawl crawls and converts websites into LLM-ready data.',
        },
      ],
      news: [],
    });

    const result = (await webResearch.execute(
      { query: 'What does Firecrawl do?', maxResults: 3 },
      { toolCallId: 'test-2', messages: [], context: {} }
    )) as {
      query: string;
      count: number;
      results: Array<{ title: string; url: string; content: string }>;
    };

    expect(result.count).toBe(1);
    expect(result.results[0]?.url).toBe('https://www.firecrawl.dev');
    expect(result.results[0]?.content).toContain('LLM-ready');
    expect(searchMock).toHaveBeenCalled();
  });
});
