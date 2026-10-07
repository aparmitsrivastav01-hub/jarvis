import { Firecrawl } from 'firecrawl';
import { tool } from 'ai';
import { z } from 'zod';

function getFirecrawlApiKey(): string | undefined {
  return process.env.FIRECRAWL_API_KEY;
}

// Configuration limits to prevent context flooding
const MAX_RESULTS = 5;
const MAX_CONTENT_LENGTH = 2000; // characters per result
const MAX_TOTAL_CONTENT = 10000; // total characters across all results

function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + '...';
}

export const webResearch = tool({
  description: 'Research public web pages and retrieve relevant information for questions that require current or webpage-specific information. Use this when you need up-to-date information, specific documentation, or details from public websites.',
  inputSchema: z.object({
    query: z.string().describe('Search query to research on the web'),
    maxResults: z.number().optional().default(3).describe('Maximum number of results to retrieve (1-5)'),
  }),
  execute: async ({ query, maxResults = 3 }, { toolCallId }) => {
    // Check for API key
    const apiKey = getFirecrawlApiKey();
    if (!apiKey) {
      throw new Error(
        'FIRECRAWL_API_KEY is not configured. Please add it to your .env file. ' +
        'Get an API key from https://firecrawl.dev'
      );
    }

    // Validate maxResults
    const limit = Math.min(Math.max(maxResults, 1), MAX_RESULTS);

    try {
      const firecrawl = new Firecrawl({
        apiKey: apiKey,
      });

      // Perform search
      const searchResponse = await firecrawl.search(query, {
        limit,
        timeout: 30000, // 30 second timeout
      });

      // Firecrawl SDK returns { data: { web: [...] } } structure
      const results = (searchResponse as any)?.data?.web || [];

      if (results.length === 0) {
        return {
          query,
          results: [],
          message: 'No results found for the given query.',
        };
      }

      // Process and normalize results
      const processedResults = results.slice(0, limit).map((result: any) => {
        const title = result.title || 'Untitled';
        const url = result.url || '';
        const description = result.description || '';
        const markdown = result.markdown || '';
        
        // Truncate content to avoid context flooding
        const content = truncateContent(
          markdown || description,
          MAX_CONTENT_LENGTH
        );

        return {
          title,
          url,
          content,
          description: truncateContent(description, 500),
        };
      });

      // Calculate total content and truncate if necessary
      let totalContent = processedResults.reduce(
        (sum: number, r: { content: string }) => sum + r.content.length,
        0
      );

      if (totalContent > MAX_TOTAL_CONTENT) {
        const ratio = MAX_TOTAL_CONTENT / totalContent;
        processedResults.forEach((result: { content: string }) => {
          result.content = truncateContent(
            result.content,
            Math.floor(result.content.length * ratio)
          );
        });
      }

      return {
        query,
        results: processedResults,
        count: processedResults.length,
        message: `Retrieved ${processedResults.length} relevant sources.`,
      };
    } catch (error) {
      if (error instanceof Error) {
        // Handle specific error types
        if (error.message.includes('401') || error.message.includes('403')) {
          throw new Error('Invalid Firecrawl API key. Please check your FIRECRAWL_API_KEY.');
        }
        if (error.message.includes('429')) {
          throw new Error('Firecrawl rate limit exceeded. Please try again later.');
        }
        if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
          throw new Error('Firecrawl request timed out. Please try again.');
        }
        throw new Error(`Web research failed: ${error.message}`);
      }
      throw new Error('Web research failed with an unknown error.');
    }
  },
});
