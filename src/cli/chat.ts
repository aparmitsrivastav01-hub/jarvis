import readline from 'readline';
import { jarvisAgent } from '../agent/jarvis.js';
import { OLLAMA_HOST, OLLAMA_MODEL } from '../models/ollama.js';
import { AudioRecorder, AudioPlayer, transcribeAudio, synthesizeSpeech } from '../utils/audio.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function printBanner() {
  console.log('========================================');
  console.log('              JARVIS');
  console.log('       Local Agentic Assistant');
  console.log('========================================');
  console.log('');
  console.log(`Model: ${OLLAMA_MODEL}`);
  console.log(`Host: ${OLLAMA_HOST}`);
  console.log('');
  console.log('Type "exit" or "quit" to leave.');
  console.log('Type "/voice" to toggle voice mode.');
  console.log('');
}

function formatToolCall(toolName: string): string {
  return `[tool] ${toolName}`;
}

async function checkOllamaConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}

async function chatLoop() {
  printBanner();

  const isOllamaAvailable = await checkOllamaConnection();
  
  if (!isOllamaAvailable) {
    console.error('ERROR: Cannot connect to Ollama.');
    console.error('');
    console.error('Please ensure Ollama is running:');
    console.error('  - On Windows: Start Ollama from the Start menu');
    console.error('  - On macOS/Linux: Run "ollama serve" in a terminal');
    console.error('');
    console.error(`Expected Ollama at: ${OLLAMA_HOST}`);
    console.error('');
    console.error('Once Ollama is running, restart Jarvis.');
    rl.close();
    process.exit(1);
  }

  let voiceMode = false;
  const audioRecorder = new AudioRecorder();
  const audioPlayer = new AudioPlayer();

  const askQuestion = (): Promise<string> => {
    return new Promise((resolve) => {
      rl.question('You: > ', (answer) => {
        resolve(answer);
      });
    });
  };

  while (true) {
    let input: string;

    if (voiceMode) {
      console.log('🎤 Voice mode: Type your message (audio recording disabled on Windows CLI)');
      console.log('   For voice input, provide audio file path with /transcribe <path>');
      input = await askQuestion();
      
      // Check if user wants to transcribe an audio file
      if (input.trim().startsWith('/transcribe ')) {
        const filePath = input.trim().replace('/transcribe ', '').trim();
        console.log('🔊 Processing audio file...');
        
        try {
          const audioBuffer = await audioRecorder.recordFromFile(filePath);
          if (audioBuffer.length === 0) {
            console.log('Error: Could not read audio file. Using text input.');
            input = input.trim().replace('/transcribe ' + filePath + ' ', '');
          } else {
            input = await transcribeAudio(audioBuffer);
            console.log(`📝 Transcript: "${input}"`);
          }
        } catch (error) {
          console.error('Speech-to-text error:', error instanceof Error ? error.message : error);
          console.log('Using text input...');
          input = input.trim().replace('/transcribe ' + filePath + ' ', '');
        }
      }
    } else {
      input = await askQuestion();
    }

    const trimmedInput = input.trim();

    if (trimmedInput === 'exit' || trimmedInput === 'quit') {
      console.log('Goodbye!');
      rl.close();
      process.exit(0);
    }

    if (trimmedInput === '/voice') {
      voiceMode = !voiceMode;
      console.log(`Voice mode: ${voiceMode ? 'ON' : 'OFF'}`);
      console.log('');
      continue;
    }

    if (trimmedInput === '') {
      continue;
    }

    try {
      console.log('Jarvis: >');

      const result = await jarvisAgent.stream({
        prompt: trimmedInput,
      });

      const fullStream = (
        result as unknown as {
          fullStream?: AsyncIterable<{
            type?: string;
            toolName?: string;
            text?: string;
            textDelta?: string;
          }>;
        }
      ).fullStream;

      let fullResponse = '';
      let usedTextToSpeech = false;

      if (fullStream) {
        for await (const part of fullStream) {
          if (part.type === 'tool-call' && part.toolName) {
            console.log(formatToolCall(part.toolName));
            if (part.toolName === 'textToSpeech') {
              usedTextToSpeech = true;
            }
          }

          if (part.type === 'text-delta') {
            const text = part.text ?? part.textDelta ?? '';
            process.stdout.write(text);
            fullResponse += text;
          }
        }
      } else {
        for await (const chunk of result.textStream) {
          process.stdout.write(chunk);
          fullResponse += chunk;
        }
      }
      
      console.log('');
      console.log('');

      // If in voice mode and agent didn't use textToSpeech, automatically synthesize
      if (voiceMode && !usedTextToSpeech && fullResponse.trim()) {
        try {
          console.log('🔊 Speaking response...');
          const audioBuffer = await synthesizeSpeech(fullResponse);
          await audioPlayer.play(audioBuffer);
        } catch (error) {
          console.error('Text-to-speech error:', error instanceof Error ? error.message : error);
        }
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      console.log('');
    }
  }
}

// Handle Ctrl+C
rl.on('SIGINT', () => {
  console.log('\nGoodbye!');
  rl.close();
  process.exit(0);
});

chatLoop().catch((error) => {
  console.error('Fatal error:', error instanceof Error ? error.message : String(error));
  rl.close();
  process.exit(1);
});
