import { ToolLoopAgent, isStepCount } from 'ai';
import { ollamaModel } from '../models/ollama.js';
import { SYSTEM_PROMPT } from './system-prompt.js';
import { tools } from '../tools/index.js';

export const jarvisAgent = new ToolLoopAgent({
  model: ollamaModel,
  instructions: SYSTEM_PROMPT,
  tools,
  stopWhen: isStepCount(10),
});

export async function runJarvisPrompt(prompt: string): Promise<string> {
  const generate = (
    jarvisAgent as unknown as {
      generate?: (input: { prompt: string }) => Promise<{ text?: string }>;
    }
  ).generate;

  if (typeof generate === 'function') {
    const result = await generate.call(jarvisAgent, { prompt });
    return (result.text || '').trim();
  }

  const result = await jarvisAgent.stream({ prompt });
  let text = '';

  for await (const chunk of result.textStream) {
    text += chunk;
  }

  return text.trim();
}
