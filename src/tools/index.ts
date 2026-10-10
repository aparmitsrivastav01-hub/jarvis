import { getCurrentTime } from './get-current-time.js';
import { webResearch } from './firecrawl.js';
import { webAgent } from './tinyfish.js';
import { speechToText, textToSpeech } from './gnani.js';

export const tools = {
  getCurrentTime,
  webResearch,
  webAgent,
  speechToText,
  textToSpeech,
};

export { getCurrentTime, webResearch, webAgent, speechToText, textToSpeech };
