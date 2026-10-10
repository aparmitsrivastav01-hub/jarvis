import { tool } from 'ai';
import { z } from 'zod';

function getGnaniApiKey(): string | undefined {
  return process.env.GNANI_API_KEY;
}

const GNANI_BASE_URL = 'https://api.vachana.ai';

// STT Tool - Speech to Text
export const speechToText = tool({
  description: 'Transcribe audio to text using Gnani Speech-to-Text API. Use this when the user provides audio input or needs speech transcription.',
  inputSchema: z.object({
    audioData: z.string().describe('Base64-encoded audio data'),
    filename: z.string().describe('Audio filename with extension (e.g., audio.wav)'),
    languageCode: z.string().default('en-IN').describe('Language code (e.g., en-IN, hi-IN)'),
    format: z.enum(['verbatim', 'transcribe']).default('verbatim').describe('Output format'),
  }),
  execute: async ({ audioData, filename, languageCode, format }) => {
    const apiKey = getGnaniApiKey();
    if (!apiKey) {
      throw new Error('GNANI_API_KEY is not configured. Please add it to your .env file.');
    }

    try {
      const formData = new FormData();
      const audioBuffer = Buffer.from(audioData, 'base64');
      formData.append('audio_file', new Blob([audioBuffer]), filename);
      formData.append('language_code', languageCode);
      formData.append('format', format);

      const response = await fetch(`${GNANI_BASE_URL}/stt/v3`, {
        method: 'POST',
        headers: {
          'X-API-Key-ID': apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gnani STT error: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as { transcript?: string; request_id?: string };
      return {
        transcript: result.transcript || '',
        requestId: result.request_id || '',
        languageCode,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('403')) {
          throw new Error('Invalid Gnani API key. Please check GNANI_API_KEY.');
        }
        if (error.message.includes('429')) {
          throw new Error('Gnani rate limit exceeded. Please try again later.');
        }
        throw new Error(`Speech-to-text failed: ${error.message}`);
      }
      throw new Error('Speech-to-text failed with an unknown error.');
    }
  },
});

// TTS Tool - Text to Speech
export const textToSpeech = tool({
  description: 'Convert text to speech using Gnani Text-to-Speech API. Use this when the user needs audio output or text-to-speech conversion.',
  inputSchema: z.object({
    text: z.string().describe('Text to synthesize'),
    voice: z.string().default('Pranav').describe('Voice ID (e.g., Pranav, Nalini)'),
    language: z.string().default('en-IN').describe('Language code (e.g., en-IN, hi-IN)'),
    speed: z.number().default(1.0).describe('Speaking rate (0.85-1.15)'),
  }),
  execute: async ({ text, voice, language, speed }) => {
    const apiKey = getGnaniApiKey();
    if (!apiKey) {
      throw new Error('GNANI_API_KEY is not configured. Please add it to your .env file.');
    }

    try {
      const response = await fetch(`${GNANI_BASE_URL}/api/v1/tts/inference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key-ID': apiKey,
        },
        body: JSON.stringify({
          text,
          voice,
          model: 'timbre-v2.5',
          language,
          speed,
          audio_config: {
            sample_rate: 48000,
            num_channels: 1,
            sample_width: 2,
            encoding: 'linear_pcm',
            container: 'wav',
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gnani TTS error: ${response.status} - ${errorText}`);
      }

      const audioBuffer = await response.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString('base64');

      return {
        audioData: audioBase64,
        format: 'wav',
        sampleRate: 48000,
        voice,
        language,
        textLength: text.length,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('403')) {
          throw new Error('Invalid Gnani API key. Please check GNANI_API_KEY.');
        }
        if (error.message.includes('429')) {
          throw new Error('Gnani rate limit exceeded. Please try again later.');
        }
        throw new Error(`Text-to-speech failed: ${error.message}`);
      }
      throw new Error('Text-to-speech failed with an unknown error.');
    }
  },
});
