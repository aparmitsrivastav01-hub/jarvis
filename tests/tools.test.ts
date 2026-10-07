import { describe, it, expect } from 'vitest';
import { getCurrentTime } from '../src/tools/get-current-time.js';

describe('getCurrentTime tool', () => {
  it('should return local time when no timezone is provided', async () => {
    const result = await getCurrentTime.execute({}, { toolCallId: 'test-1', messages: [], context: {} }) as { iso: string; timezone: string; readable: string };
    
    expect(result).toHaveProperty('iso');
    expect(result).toHaveProperty('timezone');
    expect(result).toHaveProperty('readable');
    
    expect(typeof result.iso).toBe('string');
    expect(typeof result.timezone).toBe('string');
    expect(typeof result.readable).toBe('string');
    
    // Verify ISO format
    expect(result.iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should return time in a valid timezone when provided', async () => {
    const result = await getCurrentTime.execute({ timezone: 'America/New_York' }, { toolCallId: 'test-2', messages: [], context: {} }) as { iso: string; timezone: string; readable: string };
    
    expect(result).toHaveProperty('iso');
    expect(result).toHaveProperty('timezone');
    expect(result).toHaveProperty('readable');
    
    expect(result.timezone).toBe('America/New_York');
    expect(typeof result.iso).toBe('string');
    expect(typeof result.readable).toBe('string');
  });

  it('should return time in Asia/Kolkata timezone', async () => {
    const result = await getCurrentTime.execute({ timezone: 'Asia/Kolkata' }, { toolCallId: 'test-3', messages: [], context: {} }) as { iso: string; timezone: string; readable: string };
    
    expect(result.timezone).toBe('Asia/Kolkata');
    expect(result.iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should return time in America/New_York timezone', async () => {
    const result = await getCurrentTime.execute({ timezone: 'America/New_York' }, { toolCallId: 'test-4', messages: [], context: {} }) as { iso: string; timezone: string; readable: string };
    
    expect(result.timezone).toBe('America/New_York');
    expect(result.iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should throw error for invalid timezone', async () => {
    await expect(getCurrentTime.execute({ timezone: 'Invalid/Timezone' }, { toolCallId: 'test-5', messages: [], context: {} })).rejects.toThrow();
  });

  it('should have proper tool schema', () => {
    expect(getCurrentTime.description).toBeTypeOf('string');
    expect(getCurrentTime.inputSchema).toBeDefined();
  });
});
