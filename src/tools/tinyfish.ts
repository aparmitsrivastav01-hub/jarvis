import { TinyFish } from '@tiny-fish/sdk';
import { tool } from 'ai';
import { z } from 'zod';

const MAX_RESULT_LENGTH = 6000;
const MAX_SOURCES = 8;

const URL_PATTERN = /https?:\/\/[^\s"'<>)]+/gi;

export type WebAgentSuccess = {
  success: true;
  goal: string;
  url: string;
  result: string;
  sources: string[];
};

export type WebAgentFailure = {
  success: false;
  goal: string;
  url?: string;
  error: string;
};

export type WebAgentResult = WebAgentSuccess | WebAgentFailure;

function getTinyFishApiKey(): string | undefined {
  return process.env.TINYFISH_API_KEY;
}

function redactSecrets(text: string): string {
  const secrets = [
    process.env.TINYFISH_API_KEY,
    process.env.FIRECRAWL_API_KEY,
    process.env.GNANI_API_KEY,
  ].filter((value): value is string => Boolean(value));

  let sanitized = text;

  for (const secret of secrets) {
    sanitized = sanitized.split(secret).join('[redacted]');
  }

  return sanitized;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

export function extractUrlFromText(text: string): string | undefined {
  const match = text.match(/https?:\/\/[^\s"'<>)]+/i);
  return match?.[0];
}

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const url of urls) {
    const cleaned = url.replace(/[.,;]+$/, '');
    if (!cleaned || seen.has(cleaned)) {
      continue;
    }
    seen.add(cleaned);
    result.push(cleaned);
    if (result.length >= MAX_SOURCES) {
      break;
    }
  }

  return result;
}

function collectUrls(value: unknown, found: string[]): void {
  if (typeof value === 'string') {
    const matches = value.match(URL_PATTERN);
    if (matches) {
      found.push(...matches);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectUrls(item, found);
    }
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (key.toLowerCase().includes('url') && typeof nested === 'string') {
        found.push(nested);
      }
      collectUrls(nested, found);
    }
  }
}

function stringifyResult(value: unknown): string {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    if (typeof record.result === 'string') {
      return record.result.trim();
    }

    if (typeof record.summary === 'string' && Object.keys(record).length <= 3) {
      const extra = Object.entries(record)
        .filter(([key]) => key !== 'summary')
        .map(([key, nested]) => `${key}: ${typeof nested === 'string' ? nested : JSON.stringify(nested)}`)
        .join('\n');

      return extra ? `${record.summary}\n${extra}` : record.summary;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

export function normalizeTinyFishResult(input: {
  goal: string;
  url: string;
  status?: string | null;
  result?: unknown;
  error?: { message?: string } | string | null;
}): WebAgentResult {
  const { goal, url, status, result, error } = input;

  if (status && status !== 'COMPLETED') {
    const errorMessage =
      typeof error === 'string'
        ? error
        : error?.message || `TinyFish run ended with status ${status}.`;

    return {
      success: false,
      goal,
      url,
      error: redactSecrets(errorMessage),
    };
  }

  if (error) {
    const errorMessage = typeof error === 'string' ? error : error.message || 'TinyFish run failed.';
    return {
      success: false,
      goal,
      url,
      error: redactSecrets(errorMessage),
    };
  }

  const foundUrls: string[] = [url];
  collectUrls(result, foundUrls);

  const normalized = truncateText(stringifyResult(result), MAX_RESULT_LENGTH);

  if (!normalized) {
    return {
      success: false,
      goal,
      url,
      error: 'TinyFish completed without returning usable extracted information.',
    };
  }

  return {
    success: true,
    goal,
    url,
    result: normalized,
    sources: uniqueUrls(foundUrls),
  };
}

export async function executeWebAgent(input: {
  goal: string;
  url?: string;
}): Promise<WebAgentResult> {
  const goal = input.goal.trim();
  const url = input.url?.trim() || extractUrlFromText(goal);

  if (!url) {
    return {
      success: false,
      goal,
      error:
        'TinyFish requires a target website URL. Provide a URL or include one in the goal.',
    };
  }

  const apiKey = getTinyFishApiKey();

  if (!apiKey) {
    return {
      success: false,
      goal,
      url,
      error: 'TINYFISH_API_KEY is not configured. Add it to your .env file.',
    };
  }

  try {
    const client = new TinyFish({ apiKey });

    const response = await client.agent.run({
      goal,
      url,
    });

    return normalizeTinyFishResult({
      goal,
      url,
      status: response.status,
      result: response.result,
      error: response.error,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'TinyFish request failed with an unknown error.';

    const lower = message.toLowerCase();

    if (lower.includes('401') || lower.includes('invalid api key') || lower.includes('authentication')) {
      return {
        success: false,
        goal,
        url,
        error: 'Invalid TinyFish API key. Please check TINYFISH_API_KEY.',
      };
    }

    if (lower.includes('429') || lower.includes('rate limit')) {
      return {
        success: false,
        goal,
        url,
        error: 'TinyFish rate limit exceeded. Please try again later.',
      };
    }

    return {
      success: false,
      goal,
      url,
      error: redactSecrets(`Browser action failed: ${message}`),
    };
  }
}

export const webAgent = tool({
  description:
    'This tool performs real browser/web actions. Use it when the user wants JARVIS to navigate, interact with, inspect, or perform an action on a live website. Do not use it for ordinary web research when Firecrawl is sufficient.',

  inputSchema: z.object({
    goal: z
      .string()
      .describe('Natural-language browser goal, e.g. open a page and extract specifications.'),
    url: z
      .string()
      .optional()
      .describe('Target website URL. Required by TinyFish if it is not already in the goal.'),
  }),

  execute: async ({ goal, url }) => executeWebAgent({ goal, url }),
});
