import dotenv from 'dotenv';
import { createOllama } from 'ollama-ai-provider-v2';

dotenv.config();

const rawHost =
  process.env.OLLAMA_BASE_URL ||
  process.env.OLLAMA_HOST ||
  'http://localhost:11434';

const OLLAMA_HOST = rawHost.replace(/\/api\/?$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

const ollamaProvider = createOllama({
  baseURL: `${OLLAMA_HOST}/api`,
});

export const ollamaModel = ollamaProvider(OLLAMA_MODEL);

export { OLLAMA_HOST, OLLAMA_MODEL };
