import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
// @ts-ignore - No type definitions available
import player from 'play-sound';
import { speechToText, textToSpeech } from '../tools/gnani.js';

const execAsync = promisify(exec);

const SAMPLE_RATE = 48000;
const CHANNELS = 1;
const BIT_DEPTH = 16;

export class AudioRecorder {
  async recordForDuration(seconds: number): Promise<Buffer> {
    const tempPath = path.join(process.cwd(), 'temp-recording.wav');
    
    try {
      // Use PowerShell to record audio on Windows
      const psScript = `
        $duration = ${seconds}
        $output = "${tempPath.replace(/\\/g, '\\\\')}"
        
        Add-Type -AssemblyName System.Speech
        $recorder = New-Object System.Speech.Recognition.SpeechRecognitionEngine
        $recorder.SetInputToDefaultAudioDevice()
        
        # This is a simplified approach - for full recording we'd need different APIs
        # For now, we'll create a placeholder
        Write-Host "Recording for $duration seconds..."
        Start-Sleep -Seconds $duration
      `;
      
      await execAsync(`powershell -Command "${psScript}"`);
      
      // Since PowerShell speech recognition is complex, let's use a simpler approach
      // For now, return empty buffer and let user know
      console.log('Note: Audio recording requires additional setup on Windows.');
      console.log('Voice input disabled. Use text input or provide audio file path.');
      
      return Buffer.alloc(0);
    } catch (error) {
      console.error('Recording error:', error instanceof Error ? error.message : error);
      return Buffer.alloc(0);
    }
  }
  
  async recordFromFile(filePath: string): Promise<Buffer> {
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      console.error('Error reading audio file:', error instanceof Error ? error.message : error);
      return Buffer.alloc(0);
    }
  }
}

export class AudioPlayer {
  private player: any;

  constructor() {
    this.player = player();
  }

  play(audioBuffer: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const tempPath = path.join(process.cwd(), 'temp-audio.wav');
      
      fs.writeFile(tempPath, audioBuffer)
        .then(() => {
          this.player.play(tempPath, (err: Error) => {
            fs.unlink(tempPath).catch(() => {});
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        })
        .catch(reject);
    });
  }
}

export async function transcribeAudio(audioBuffer: Buffer, languageCode = 'en-IN'): Promise<string> {
  const audioBase64 = audioBuffer.toString('base64');
  
  const result = await speechToText.execute(
    {
      audioData: audioBase64,
      filename: 'recording.wav',
      languageCode,
      format: 'verbatim',
    },
    { toolCallId: 'stt-call', messages: [], context: {} }
  ) as { transcript: string; requestId: string; languageCode: string };

  return result.transcript || '';
}

export async function synthesizeSpeech(text: string, voice = 'Pranav', language = 'en-IN'): Promise<Buffer> {
  const result = await textToSpeech.execute(
    {
      text,
      voice,
      language,
      speed: 1.0,
    },
    { toolCallId: 'tts-call', messages: [], context: {} }
  ) as { audioData: string; format: string; sampleRate: number; voice: string; language: string; textLength: number };

  return Buffer.from(result.audioData, 'base64');
}
