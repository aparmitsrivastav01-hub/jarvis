import { tool } from 'ai';
import { z } from 'zod';

export const getCurrentTime = tool({
  description: 'Get the current time in a specific timezone or local system time',
  inputSchema: z.object({
    timezone: z.string().optional().describe('IANA timezone string (e.g., "America/New_York", "Asia/Kolkata")'),
  }),
  execute: async ({ timezone }) => {
    try {
      const now = new Date();
      
      if (timezone) {
        const options: Intl.DateTimeFormatOptions = {
          timeZone: timezone,
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        };
        
        const formatter = new Intl.DateTimeFormat('en-US', options);
        const parts = formatter.formatToParts(now);
        
        const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
        
        const year = getPart('year');
        const month = getPart('month').padStart(2, '0');
        const day = getPart('day').padStart(2, '0');
        const hour = getPart('hour').padStart(2, '0');
        const minute = getPart('minute').padStart(2, '0');
        const second = getPart('second').padStart(2, '0');
        
        const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
        const readable = formatter.format(now);
        
        return {
          iso,
          timezone,
          readable,
        };
      } else {
        const iso = now.toISOString();
        const readable = now.toLocaleString();
        
        return {
          iso,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          readable,
        };
      }
    } catch (error) {
      throw new Error(`Failed to get time for timezone "${timezone}": ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});
