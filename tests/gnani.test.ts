import { describe, it, expect, vi, beforeEach } from 'vitest';

import { speechToText, textToSpeech } from '../src/tools/gnani.js';

describe('Gnani tools', () => {
  beforeEach(() => {
    delete process.env.GNANI_API_KEY;
    vi.clearAllMocks();
  });

  describe('speechToText', () => {
    it('should throw error when GNANI_API_KEY is missing', async () => {
      await expect(
        speechToText.execute(
          { audioData: 'base64data', filename: 'audio.wav', languageCode: 'en-IN', format: 'verbatim' },
          { toolCallId: 'test-1', messages: [], context: {} }
        )
      ).rejects.toThrow('GNANI_API_KEY is not configured');
    });

    it('should have proper tool schema', () => {
      expect(speechToText.description).toContain('Speech-to-Text');
      expect(speechToText.inputSchema).toBeDefined();
    });
  });

  describe('textToSpeech', () => {
    it('should throw error when GNANI_API_KEY is missing', async () => {
      await expect(
        textToSpeech.execute(
          { text: 'Hello world', voice: 'Pranav', language: 'en-IN', speed: 1.0 },
          { toolCallId: 'test-2', messages: [], context: {} }
        )
      ).rejects.toThrow('GNANI_API_KEY is not configured');
    });

    it('should have proper tool schema', () => {
      expect(textToSpeech.description).toContain('Text-to-Speech');
      expect(textToSpeech.inputSchema).toBeDefined();
    });
  });
});
