import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transcribeAudio } from '../src/voice/gnani-stt.js';

describe('Gnani STT', () => {
  beforeEach(() => {
    delete process.env.GNANI_API_KEY;
  });

  it('throws when GNANI_API_KEY is missing', async () => {
    await expect(transcribeAudio('./audio/question.wav')).rejects.toThrow(
      'GNANI_API_KEY is not configured'
    );
  });

  it('sends multipart audio to the Prisma STT endpoint and normalizes the transcript', async () => {
    process.env.GNANI_API_KEY = 'gnani-test-key';

    const dir = await mkdtemp(path.join(os.tmpdir(), 'jarvis-stt-'));
    const filePath = path.join(dir, 'question.wav');
    await writeFile(filePath, Buffer.from('fake-wav'));

    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://api.vachana.ai/stt/v3');
      expect((init?.headers as Record<string, string>)['X-API-Key-ID']).toBe(
        'gnani-test-key'
      );
      expect(init?.body).toBeInstanceOf(FormData);

      const form = init?.body as FormData;
      expect(form.get('language_code')).toBe('hi-IN');
      expect(form.get('multi_lang_codes')).toBe(JSON.stringify(['hi-IN', 'en-IN']));

      return new Response(
        JSON.stringify({
          success: true,
          transcript: 'Research the latest AI news',
          request_id: 'req_123',
          language_code: 'hi-IN',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const result = await transcribeAudio(filePath, { fetchImpl });

    expect(result).toEqual({
      transcript: 'Research the latest AI news',
      language: 'hi-IN',
      requestId: 'req_123',
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('does not leak the API key when STT fails', async () => {
    process.env.GNANI_API_KEY = 'gnani-secret-value';

    const dir = await mkdtemp(path.join(os.tmpdir(), 'jarvis-stt-'));
    const filePath = path.join(dir, 'question.wav');
    await writeFile(filePath, Buffer.from('fake-wav'));

    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: false,
          error: { message: 'Unauthorized gnani-secret-value' },
        }),
        { status: 401 }
      );
    });

    await expect(transcribeAudio(filePath, { fetchImpl })).rejects.toThrow(
      'Invalid Gnani API key'
    );
  });
});
