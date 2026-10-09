import path from 'node:path';
import { runJarvisPrompt } from '../agent/jarvis.js';
import { OLLAMA_HOST, OLLAMA_MODEL } from '../models/ollama.js';
import { transcribeAudio, synthesizeSpeech } from '../voice/index.js';

function printUsage(): void {
  console.log('Usage: npm run voice -- <audio-file> [--output <wav-path>]');
  console.log('');
  console.log('Example:');
  console.log('  npm run voice -- ./audio/question.wav');
}

async function checkOllamaConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}

function parseArgs(argv: string[]): { inputPath?: string; outputPath: string } {
  const args = argv.slice(2);
  let outputPath = path.join('output', 'jarvis-response.wav');
  const positional: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--output' || arg === '-o') {
      outputPath = args[i + 1] || outputPath;
      i += 1;
      continue;
    }

    positional.push(arg);
  }

  return {
    inputPath: positional[0],
    outputPath,
  };
}

async function main(): Promise<void> {
  const { inputPath, outputPath } = parseArgs(process.argv);

  if (!inputPath) {
    printUsage();
    process.exit(1);
  }

  console.log('========================================');
  console.log('         JARVIS Voice Mode');
  console.log('========================================');
  console.log(`Model: ${OLLAMA_MODEL}`);
  console.log(`Host: ${OLLAMA_HOST}`);
  console.log(`Input: ${inputPath}`);
  console.log('');

  const isOllamaAvailable = await checkOllamaConnection();

  if (!isOllamaAvailable) {
    console.error('ERROR: Cannot connect to Ollama.');
    console.error(`Expected Ollama at: ${OLLAMA_HOST}`);
    process.exit(1);
  }

  console.log('[voice] Transcribing audio with Gnani STT...');
  const transcription = await transcribeAudio(path.resolve(inputPath));
  console.log(`[voice] Transcript: ${transcription.transcript}`);
  console.log('');

  console.log('[voice] Running JARVIS agent...');
  const answer = await runJarvisPrompt(transcription.transcript);

  if (!answer) {
    throw new Error('JARVIS returned an empty text response.');
  }

  console.log('Jarvis: >');
  console.log(answer);
  console.log('');

  console.log('[voice] Synthesizing speech with Gnani TTS...');
  const speech = await synthesizeSpeech(answer, {
    outputPath: path.resolve(outputPath),
  });

  console.log(`[voice] Audio written to ${speech.audioPath}`);
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
