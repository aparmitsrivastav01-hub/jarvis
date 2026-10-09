import { Firecrawl } from 'firecrawl';
import { tool } from 'ai';
import { z } from 'zod';

function getFirecrawlApiKey(): string | undefined {
  return process.env.FIRECRAWL_API_KEY;
}

// Configuration limits
const MAX_RESULTS = 5;
const MAX_CONTENT_LENGTH = 2000;
const MAX_TOTAL_CONTENT = 10000;

// Keywords that indicate a need for news sources
const NEWS_KEYWORDS = [
  'today',
  'latest',
  'recent',
  'breaking',
  'news',
  'death',
  'died',
  'dead',
  'current events',
  'happened',
  'true today',
  'this morning',
  'this evening',
  'just now',
];

function shouldIncludeNews(query: string): boolean {
  const lowerQuery = query.toLowerCase();

  return NEWS_KEYWORDS.some((keyword) =>
    lowerQuery.includes(keyword)
  );
}

function truncateContent(
  content: string,
  maxLength: number
): string {
  if (!content) return '';

  if (content.length <= maxLength) {
    return content;
  }

  return content.substring(0, maxLength) + '...';
}

function debugLog(message: string, data?: unknown): void {
  if (data !== undefined) {
    console.log(
      `[Firecrawl] ${message}`,
      JSON.stringify(data)
    );
  } else {
    console.log(`[Firecrawl] ${message}`);
  }
}

type NormalizedResult = {
  title: string;
  url: string;
  description: string;
  content: string;
  sourceType: 'web' | 'news';
  date?: string;
};

export const webResearch = tool({
  description:
    'Research public web pages and retrieve relevant information for questions that require current or webpage-specific information. Use this when you need up-to-date information, specific documentation, recent news, or details from public websites.',

  inputSchema: z.object({
    query: z
      .string()
      .describe('Search query to research on the web'),

    maxResults: z
      .number()
      .optional()
      .default(3)
      .describe('Maximum number of results to retrieve (1-5)'),
  }),

  execute: async ({ query, maxResults = 3 }) => {
    const apiKey = getFirecrawlApiKey();

    if (!apiKey) {
      throw new Error(
        'FIRECRAWL_API_KEY is not configured. Please add it to your .env file.'
      );
    }

    // Keep the limit safely between 1 and 5
    const limit = Math.min(
      Math.max(Math.floor(maxResults), 1),
      MAX_RESULTS
    );

    const includeNews = shouldIncludeNews(query);

    debugLog('Starting web research');
    debugLog('Query', query);
    debugLog('Include news', includeNews);
    debugLog('Max results', limit);

    try {
      const firecrawl = new Firecrawl({
        apiKey,
      });

      const searchOptions: any = {
        limit,
        timeout: 30000,
        scrapeOptions: {
          formats: ['markdown'],
        },
      };

      if (includeNews) {
        searchOptions.sources = ['web', 'news'];
      }

      debugLog('Calling Firecrawl search');

      const searchResponse = await firecrawl.search(
        query,
        searchOptions
      );

      /*
       * Current Firecrawl SDK response structure:
       *
       * {
       *   web: [...],
       *   news: [...],
       *   images: [...]
       * }
       *
       * Do NOT use searchResponse.data.
       */

      const response = searchResponse as any;

      const webResults = Array.isArray(response.web)
        ? response.web
        : [];

      const newsResults = Array.isArray(response.news)
        ? response.news
        : [];

      debugLog('Web results count', webResults.length);
      debugLog('News results count', newsResults.length);

      const normalizedWebResults: NormalizedResult[] = [];
      const normalizedNewsResults: NormalizedResult[] = [];

      // -----------------------------
      // Normalize WEB results
      // -----------------------------

      for (const result of webResults.slice(0, limit)) {
        const title =
          typeof result.title === 'string'
            ? result.title
            : 'Untitled';

        const url =
          typeof result.url === 'string'
            ? result.url
            : '';

        const description =
          typeof result.description === 'string'
            ? result.description
            : '';

        const markdown =
          typeof result.markdown === 'string'
            ? result.markdown
            : '';

        const rawContent =
          markdown ||
          (typeof result.content === 'string'
            ? result.content
            : '') ||
          description;

        normalizedWebResults.push({
          title,
          url,
          description: truncateContent(
            description,
            500
          ),
          content: truncateContent(
            rawContent,
            MAX_CONTENT_LENGTH
          ),
          sourceType: 'web',
        });
      }

      // -----------------------------
      // Normalize NEWS results
      // -----------------------------

      for (const result of newsResults.slice(0, limit)) {
        const title =
          typeof result.title === 'string'
            ? result.title
            : 'Untitled';

        const url =
          typeof result.url === 'string'
            ? result.url
            : '';

        /*
         * News results may use `snippet`
         * instead of `description`.
         */
        const description =
          typeof result.description === 'string'
            ? result.description
            : typeof result.snippet === 'string'
              ? result.snippet
              : '';

        const markdown =
          typeof result.markdown === 'string'
            ? result.markdown
            : '';

        const rawContent =
          markdown ||
          (typeof result.content === 'string'
            ? result.content
            : '') ||
          description;

        const date =
          typeof result.date === 'string'
            ? result.date
            : undefined;

        normalizedNewsResults.push({
          title,
          url,
          description: truncateContent(
            description,
            500
          ),
          content: truncateContent(
            rawContent,
            MAX_CONTENT_LENGTH
          ),
          sourceType: 'news',
          ...(date ? { date } : {}),
        });
      }

      /*
       * IMPORTANT:
       *
       * Previously we did:
       *
       * [...webResults, ...newsResults].slice(0, limit)
       *
       * That could completely remove NEWS results.
       *
       * For current/news queries, prioritize news.
       */

      let finalResults: NormalizedResult[];

      if (includeNews) {
        const prioritizedNews = normalizedNewsResults.slice(
          0,
          Math.min(3, limit)
        );

        const remainingSlots =
          limit - prioritizedNews.length;

        const supportingWeb = normalizedWebResults.slice(
          0,
          Math.max(remainingSlots, 0)
        );

        finalResults = [
          ...prioritizedNews,
          ...supportingWeb,
        ];
      } else {
        finalResults = normalizedWebResults.slice(
          0,
          limit
        );
      }

      debugLog(
        'Final normalized results',
        {
          total: finalResults.length,
          news: finalResults.filter(
            (r) => r.sourceType === 'news'
          ).length,
          web: finalResults.filter(
            (r) => r.sourceType === 'web'
          ).length,
        }
      );

      // -----------------------------
      // No results
      // -----------------------------

      if (finalResults.length === 0) {
        debugLog('No results found');

        return {
          query,
          results: [],
          count: 0,
          message:
            'No results were found for this query. Do not invent information that was not returned by the web search.',
        };
      }

      // -----------------------------
      // Total content limit
      // -----------------------------

      let totalContent = finalResults.reduce(
        (sum, result) =>
          sum +
          result.content.length +
          result.description.length,
        0
      );

      if (totalContent > MAX_TOTAL_CONTENT) {
        const ratio =
          MAX_TOTAL_CONTENT / totalContent;

        for (const result of finalResults) {
          result.content = truncateContent(
            result.content,
            Math.max(
              100,
              Math.floor(
                result.content.length * ratio
              )
            )
          );
        }
      }

      // Recalculate AFTER truncation
      totalContent = finalResults.reduce(
        (sum, result) =>
          sum +
          result.content.length +
          result.description.length,
        0
      );

      const newsCount = finalResults.filter(
        (result) => result.sourceType === 'news'
      ).length;

      const webCount = finalResults.filter(
        (result) => result.sourceType === 'web'
      ).length;

      debugLog(
        'Passing results to agent',
        {
          count: finalResults.length,
          news: newsCount,
          web: webCount,
          totalChars: totalContent,
        }
      );

      /*
       * Log only safe metadata.
       * Never log API keys.
       */
      debugLog(
        'Sources',
        finalResults.map((result) => ({
          title: result.title,
          url: result.url,
          sourceType: result.sourceType,
          date: result.date,
        }))
      );

      return {
        query,

        results: finalResults,

        count: finalResults.length,

        message:
          `Retrieved ${finalResults.length} relevant sources ` +
          `(${newsCount} news, ${webCount} web). ` +
          `Use these retrieved sources to answer the user's question. ` +
          `Do not claim that no information exists when relevant results are present.`,
      };
    } catch (error) {
      if (error instanceof Error) {
        const message = error.message;

        if (
          message.includes('401') ||
          message.includes('403')
        ) {
          throw new Error(
            'Invalid Firecrawl API key. Please check FIRECRAWL_API_KEY.'
          );
        }

        if (message.includes('429')) {
          throw new Error(
            'Firecrawl rate limit exceeded. Please try again later.'
          );
        }

        if (
          message.toLowerCase().includes('timeout') ||
          message.includes('ETIMEDOUT')
        ) {
          throw new Error(
            'Firecrawl request timed out. Please try again.'
          );
        }

        debugLog('Firecrawl error', message);

        throw new Error(
          `Web research failed: ${message}`
        );
      }

      throw new Error(
        'Web research failed with an unknown error.'
      );
    }
  },
});