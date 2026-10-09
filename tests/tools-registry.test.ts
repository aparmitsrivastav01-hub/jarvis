import { describe, it, expect } from 'vitest';
import { tools, getCurrentTime, webResearch, webAgent } from '../src/tools/index.js';
import { SYSTEM_PROMPT } from '../src/agent/system-prompt.js';

describe('tool registry', () => {
  it('exports getCurrentTime, webResearch, and webAgent', () => {
    expect(tools).toHaveProperty('getCurrentTime');
    expect(tools).toHaveProperty('webResearch');
    expect(tools).toHaveProperty('webAgent');

    expect(tools.getCurrentTime).toBe(getCurrentTime);
    expect(tools.webResearch).toBe(webResearch);
    expect(tools.webAgent).toBe(webAgent);
  });

  it('keeps Firecrawl research and TinyFish browser tools distinct', () => {
    expect(webResearch.description.toLowerCase()).toContain('research');
    expect(webAgent.description.toLowerCase()).toContain('browser');
    expect(webAgent.description).toContain('Do not use it for ordinary web research');
  });

  it('explains Firecrawl vs TinyFish selection in the system prompt', () => {
    expect(SYSTEM_PROMPT).toContain('webResearch (Firecrawl)');
    expect(SYSTEM_PROMPT).toContain('webAgent (TinyFish)');
    expect(SYSTEM_PROMPT).toContain('Do not call both');
    expect(SYSTEM_PROMPT).toContain(
      'Do not say you couldn\'t find information if a tool actually returned useful information'
    );
  });
});
