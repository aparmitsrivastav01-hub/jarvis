import dotenv from 'dotenv';
import { createOllama } from 'ollama-ai-provider-v2';

dotenv.config();

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3:8b';

const ollamaProvider = createOllama({
  baseURL: `${OLLAMA_HOST}/api`,
});

export const ollamaModel = ollamaProvider(OLLAMA_MODEL);

export { OLLAMA_HOST, OLLAMA_MODEL };
