import { readFile } from 'node:fs/promises';
import path from 'node:path';

const STT_ENDPOINT = 'https://api.vachana.ai/stt/v3';
const DEFAULT_LANGUAGE = 'hi-IN';

export type TranscribeAudioOptions = {
  language?: string;
  multiLangCodes?: string[];
  format?: 'verbatim' | 'transcribe';
  fetchImpl?: typeof fetch;
};

export type TranscriptionResult = {
  transcript: string;
  language?: string;
  requestId?: string;
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

function mimeTypeForFile(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case '.wav':
      return 'audio/wav';
    case '.mp3':
      return 'audio/mpeg';
    case '.ogg':
      return 'audio/ogg';
    case '.flac':
      return 'audio/flac';
    case '.aac':
      return 'audio/aac';
    case '.m4a':
      return 'audio/mp4';
    default:
      return 'application/octet-stream';
  }
}

async function parseErrorBody(response: Response): Promise<string> {
  const raw = await response.text();

  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string; type?: string };
      message?: string;
    };

    if (parsed.error?.message) {
      return parsed.error.message;
    }

    if (parsed.message) {
      return parsed.message;
    }
  } catch {
    // Use the raw body when it is not JSON.
  }

  return raw || `Gnani STT request failed with status ${response.status}.`;
}

export async function transcribeAudio(
  filePath: string,
  options: TranscribeAudioOptions = {}
): Promise<TranscriptionResult> {
  const apiKey = getGnaniApiKey();

  if (!apiKey) {
    throw new Error('GNANI_API_KEY is not configured. Add it to your .env file.');
  }

  if (!filePath) {
    throw new Error('An audio file path is required for transcription.');
  }

  const language = options.language || DEFAULT_LANGUAGE;
  const format = options.format || 'transcribe';
  const fetchImpl = options.fetchImpl ?? fetch;

  let audio: Buffer;

  try {
    audio = await readFile(filePath);
  } catch {
    throw new Error(`Could not read audio file: ${filePath}`);
  }

  if (audio.byteLength === 0) {
    throw new Error('Audio file is empty.');
  }

  const form = new FormData();
  const filename = path.basename(filePath);
  const blob = new Blob([new Uint8Array(audio)], {
    type: mimeTypeForFile(filePath),
  });

  form.append('audio_file', blob, filename);
  form.append('language_code', language);
  form.append('format', format);

  const multiLangCodes =
    options.multiLangCodes ??
    (language === 'hi-IN' || language === 'en-IN' ? ['hi-IN', 'en-IN'] : undefined);

  if (multiLangCodes && multiLangCodes.length > 0) {
    form.append('multi_lang_codes', JSON.stringify(multiLangCodes));
  }

  const response = await fetchImpl(STT_ENDPOINT, {
    method: 'POST',
    headers: {
      'X-API-Key-ID': apiKey,
    },
    body: form,
  });

  if (!response.ok) {
    const details = redactSecrets(await parseErrorBody(response));

    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid Gnani API key. Please check GNANI_API_KEY.');
    }

    if (response.status === 429) {
      throw new Error('Gnani STT rate limit exceeded. Please try again later.');
    }

    throw new Error(`Gnani STT failed: ${details}`);
  }

  const payload = (await response.json()) as {
    success?: boolean;
    transcript?: string;
    text?: string;
    language?: string;
    language_code?: string;
    request_id?: string;
    requestId?: string;
    error?: { message?: string };
  };

  if (payload.success === false) {
    throw new Error(
      `Gnani STT failed: ${redactSecrets(payload.error?.message || 'Unknown transcription error.')}`
    );
  }

  const transcript = (payload.transcript || payload.text || '').trim();

  if (!transcript) {
    throw new Error('Gnani STT returned an empty transcript.');
  }

  return {
    transcript,
    language: payload.language || payload.language_code || language,
    requestId: payload.request_id || payload.requestId,
  };
}
