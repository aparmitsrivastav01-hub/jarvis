import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TTS_ENDPOINT = 'https://api.vachana.ai/api/v1/tts/inference';
const DEFAULT_LANGUAGE = 'en-IN';
const DEFAULT_VOICE = 'Yashvi';
const DEFAULT_SAMPLE_RATE = 48000;
const DEFAULT_MODEL = 'timbre-v2.5';

export type SynthesizeSpeechOptions = {
  language?: string;
  voice?: string;
  sampleRate?: number;
  outputPath?: string;
  fetchImpl?: typeof fetch;
};

export type SpeechResult = {
  audioPath: string;
  byteLength: number;
  language: string;
  voice: string;
};

function getGnaniApiKey(): string | undefined {
  return process.env.GNANI_API_KEY;
}

function redactSecrets(text: string): string {
  const secret = process.env.GNANI_API_KEY;
  if (!secret) {
    return text;
  }
  return text.split(secret).join('[redacted]');
}

async function parseErrorBody(response: Response): Promise<string> {
  const raw = await response.text();

  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string };
      message?: string;
    };

    if (parsed.error?.message) {
      return parsed.error.message;
    }

    if (parsed.message) {
      return parsed.message;
    }
  } catch {
    // Binary or non-JSON error bodies fall through.
  }

  return raw.slice(0, 500) || `Gnani TTS request failed with status ${response.status}.`;
}

export async function synthesizeSpeech(
  text: string,
  options: SynthesizeSpeechOptions = {}
): Promise<SpeechResult> {
  const apiKey = getGnaniApiKey();

  if (!apiKey) {
    throw new Error('GNANI_API_KEY is not configured. Add it to your .env file.');
  }

  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error('Text is required to synthesize speech.');
  }

  const language = options.language || DEFAULT_LANGUAGE;
  const voice = options.voice || DEFAULT_VOICE;
  const sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;
  const fetchImpl = options.fetchImpl ?? fetch;
  const outputPath = path.resolve(
    options.outputPath || path.join('output', 'jarvis-response.wav')
  );

  const response = await fetchImpl(TTS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key-ID': apiKey,
    },
    body: JSON.stringify({
      text: trimmed,
      voice,
      model: DEFAULT_MODEL,
      language,
      audio_config: {
        sample_rate: sampleRate,
        num_channels: 1,
        sample_width: 2,
        encoding: 'linear_pcm',
        container: 'wav',
      },
    }),
  });

  if (!response.ok) {
    const details = redactSecrets(await parseErrorBody(response));

    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid Gnani API key. Please check GNANI_API_KEY.');
    }

    if (response.status === 429) {
      throw new Error('Gnani TTS rate limit exceeded. Please try again later.');
    }

    throw new Error(`Gnani TTS failed: ${details}`);
  }

  const audio = Buffer.from(await response.arrayBuffer());

  if (audio.byteLength === 0) {
    throw new Error('Gnani TTS returned empty audio.');
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, audio);

  return {
    audioPath: outputPath,
    byteLength: audio.byteLength,
    language,
    voice,
  };
}
