import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { synthesizeSpeech } from '../src/voice/gnani-tts.js';

describe('Gnani TTS', () => {
  beforeEach(() => {
    delete process.env.GNANI_API_KEY;
  });

  it('throws when GNANI_API_KEY is missing', async () => {
    await expect(synthesizeSpeech('Hello from JARVIS')).rejects.toThrow(
      'GNANI_API_KEY is not configured'
    );
  });

  it('posts Timbre v2.5 audio config and writes a wav file', async () => {
    process.env.GNANI_API_KEY = 'gnani-test-key';

    const dir = await mkdtemp(path.join(os.tmpdir(), 'jarvis-tts-'));
    const outputPath = path.join(dir, 'jarvis-response.wav');
    const wavBytes = Buffer.from('RIFF....WAVEfmt ');

    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://api.vachana.ai/api/v1/tts/inference');
      expect((init?.headers as Record<string, string>)['X-API-Key-ID']).toBe(
        'gnani-test-key'
      );

      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe('timbre-v2.5');
      expect(body.language).toBe('en-IN');
      expect(body.voice).toBe('Yashvi');
      expect(body.audio_config.sample_rate).toBe(48000);
      expect(body.text).toBe('Hello from JARVIS');

      return new Response(wavBytes, {
        status: 200,
        headers: { 'Content-Type': 'audio/wav' },
      });
    });

    const result = await synthesizeSpeech('Hello from JARVIS', {
      outputPath,
      fetchImpl,
    });

    expect(result.audioPath).toBe(outputPath);
    expect(result.voice).toBe('Yashvi');
    expect(result.language).toBe('en-IN');
    expect(await readFile(outputPath)).toEqual(wavBytes);
  });

  it('rejects empty text before calling the API', async () => {
    process.env.GNANI_API_KEY = 'gnani-test-key';
    const fetchImpl = vi.fn();

    await expect(synthesizeSpeech('   ', { fetchImpl })).rejects.toThrow(
      'Text is required'
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
