import readline from 'readline';
import { jarvisAgent } from '../agent/jarvis.js';
import { OLLAMA_HOST, OLLAMA_MODEL } from '../models/ollama.js';

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

  const askQuestion = (): Promise<string> => {
    return new Promise((resolve) => {
      rl.question('You: > ', (answer) => {
        resolve(answer);
      });
    });
  };

  while (true) {
    const input = await askQuestion();

    const trimmedInput = input.trim();

    if (trimmedInput === 'exit' || trimmedInput === 'quit') {
      console.log('Goodbye!');
      rl.close();
      process.exit(0);
    }

    if (trimmedInput === '') {
      continue;
    }

    try {
      console.log('Jarvis: >');
      
      const result = await jarvisAgent.stream({
        prompt: trimmedInput,
      });

      let fullResponse = '';
      
      for await (const chunk of result.textStream) {
        process.stdout.write(chunk);
        fullResponse += chunk;
      }
      
      console.log('');
      console.log('');
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
