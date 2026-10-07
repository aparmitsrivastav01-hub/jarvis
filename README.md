# JARVIS

Local Agentic AI Assistant

JARVIS is a local AI assistant powered by Ollama and Vercel AI SDK 7. It provides a clean, modular architecture for building agentic AI applications with tool capabilities.

## Architecture

```
User
 ↓
CLI
 ↓
AI SDK 7 Agent (ToolLoopAgent)
 ↓
Ollama
 ↓
Tool Loop
 ↓
Tools (getCurrentTime, webResearch)
 ↓
Ollama / Firecrawl
 ↓
Response
```

## Requirements

- **Node.js**: 22.0.0 or higher
- **Ollama**: Running locally on your machine
- **Firecrawl API Key**: For web research (optional)

## Installation

### 1. Install Ollama

Download and install Ollama from [ollama.com](https://ollama.com).

### 2. Pull a Model

Pull a supported model (e.g., qwen2.5:7b):

```bash
ollama pull qwen2.5:7b
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` to configure your settings:

```env
OLLAMA_HOST=http://localhost:11434/api
OLLAMA_MODEL=qwen2.5:7b
FIRECRAWL_API_KEY=your_api_key_here
```

### 5. Firecrawl Setup (Optional)

For web research capabilities:

1. Create a Firecrawl account at [firecrawl.dev](https://firecrawl.dev)
2. Obtain an API key
3. Add `FIRECRAWL_API_KEY=your_api_key_here` to your `.env` file

Without Firecrawl, Jarvis will still work but won't be able to perform web research.

## Usage

### Development Mode

```bash
npm run dev
```

This starts the JARVIS CLI interface where you can chat with the assistant.

### Build

```bash
npm run build
```

### Testing

```bash
npm test
```

Run tests once:

```bash
npm run test:run
```

## Project Structure

```
jarvis/
│
├── src/
│   ├── agent/
│   │   ├── jarvis.ts          # Main agent using ToolLoopAgent
│   │   └── system-prompt.ts   # System instructions
│   │
│   ├── models/
│   │   └── ollama.ts          # Ollama model provider
│   │
│   ├── tools/
│   │   ├── index.ts           # Tool registry
│   │   ├── get-current-time.ts # Time tool
│   │   └── firecrawl.ts       # Web research tool
│   │
│   ├── cli/
│   │   └── chat.ts            # CLI interface
│   │
│   └── index.ts               # Entry point
│
├── tests/
│   ├── tools.test.ts          # Tool tests
│   ├── agent.test.ts          # Agent tests
│   └── firecrawl.test.ts      # Firecrawl tests
│
├── .env.example               # Environment template
├── .gitignore
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## How Tools Work

Tools are registered in `src/tools/index.ts` and used by the agent in `src/agent/jarvis.ts`. Each tool:

- Has a clear name and description
- Uses Zod for input schema validation
- Implements an `execute` function that returns structured data

### Available Tools

#### getCurrentTime
- **Purpose**: Get current time in any timezone
- **Usage**: Jarvis automatically uses this for time-related queries
- **Example**: "What time is it in Tokyo?"

#### webResearch
- **Purpose**: Research public web pages for current information
- **Usage**: Jarvis automatically uses this when web information is needed
- **Requires**: FIRECRAWL_API_KEY
- **Example**: "What are the latest Vercel AI SDK features?"

### Adding a New Tool

1. Create a new file in `src/tools/` (e.g., `my-tool.ts`):

```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const myTool = tool({
  description: 'Description of what this tool does',
  inputSchema: z.object({
    param: z.string().describe('Parameter description'),
  }),
  execute: async ({ param }) => {
    // Tool logic here
    return { result: 'some value' };
  },
});
```

2. Register it in `src/tools/index.ts`:

```typescript
import { myTool } from './my-tool.js';

export const tools = {
  getCurrentTime,
  webResearch,
  myTool,
};
```

3. The agent will automatically be able to use the new tool.

## Security Considerations

- **No arbitrary code execution**: Tools must have explicit schemas
- **No generic shell access**: Dangerous tools require explicit implementation
- **Future approval system**: Architecture supports adding tool approval workflows
- **API key protection**: FIRECRAWL_API_KEY is never exposed to the model
- **Web access only**: Firecrawl only accesses public web content through its API
- never trust model-generated executable code without validation

## Roadmap

### Phase 1 ✅
- ✅ AI SDK 7 + Ollama core brain
- ✅ Tool system with getCurrentTime
- ✅ CLI interface
- ✅ Streaming responses

### Phase 2 ✅ (Current)
- ✅ Firecrawl web research
- ✅ webResearch tool
- ✅ Context management and truncation
- ✅ Error handling for API failures

### Phase 3
- TinyFish browser automation

### Phase 4
- Gnani STT/TTS integration

### Phase 5
- Local computer tools (filesystem, terminal)

### Phase 6
- Memory system

### Phase 7
- MCP integrations

### Phase 8
- Next.js UI

## Tech Stack

- **Node.js**: 22+
- **TypeScript**: Strict mode
- **ESM**: Module system
- **Vercel AI SDK 7**: Agent framework
- **Ollama**: Local LLM provider
- **ollama-ai-provider-v2**: AI SDK Ollama integration
- **Firecrawl**: Web research API
- **Zod**: Schema validation
- **dotenv**: Environment configuration
- **Vitest**: Testing framework
- **tsx**: Development execution

## Architectural Principles

- TypeScript strict mode
- Small, focused modules
- Clear separation of concerns
- No unnecessary framework layers
- No LangChain or LangGraph
- AI SDK handles agent/tool orchestration
- Provider-specific code stays isolated
- Tools have explicit schemas
- Modular design for future extensions
- No frontend yet
- No database yet
- No vector database yet
- No persistent memory yet

## License

ISC
