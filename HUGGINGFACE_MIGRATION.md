# HuggingFace Inference API Migration

## Summary of Changes

This update replaces the Ollama (local LLM) option with HuggingFace Inference API and adds a training data collection system for future model fine-tuning.

## Changes Made

### 1. Backend Changes

#### `backend/api/llm-orchestrator.ts`
- **Added `HuggingFaceProvider` class** implementing the `LLMProvider` interface
- Supports multiple prompt formats for different model families:
  - Llama/CodeLlama format
  - Mistral/Mixtral format
  - StarCoder format
  - Generic fallback format
- 5-minute timeout for large models
- Proper error handling for HuggingFace-specific errors (503 model loading, 429 rate limits)

#### `backend/api/direct-llm-renderer.ts`
- Replaced `generateWithOllama()` with `generateWithHuggingFace()`
- Updated interface to remove `ollama_base_url` parameter
- Same prompt formatting logic as the orchestrator

#### `backend/api/llm-renderer.ts`
- Updated `LLMRendererRequest` interface to use `'huggingface'` instead of `'ollama'`
- Integrated training data collection on successful renderer generation

#### `backend/api/visualizer.ts`
- Updated tRPC router schema to accept `'huggingface'` provider
- Updated available providers list with HuggingFace models

#### `backend/api/training-data-collector.ts` (NEW)
- **New file** for collecting successful renderer generations
- Saves data in JSONL format (standard for LLM fine-tuning)
- Tracks statistics by domain and provider
- Exports data in instruction fine-tuning format

### 2. Frontend Changes

#### `frontend/src/pages/Visualizer.tsx`
- Changed LLM provider state type from `'ollama'` to `'huggingface'`
- Updated provider selector button (🤗 HuggingFace instead of 🦙 Ollama)
- Updated model dropdown with HuggingFace model IDs
- Changed info message about API key requirement

## Available HuggingFace Models

| Model ID | Name | Description |
|----------|------|-------------|
| `codellama/CodeLlama-13b-Instruct-hf` | CodeLlama 13B | Recommended for code generation |
| `codellama/CodeLlama-34b-Instruct-hf` | CodeLlama 34B | Best code quality |
| `bigcode/starcoder2-15b` | StarCoder2 15B | Excellent for code |
| `mistralai/Mistral-7B-Instruct-v0.2` | Mistral 7B | Fast and efficient |
| `mistralai/Mixtral-8x7B-Instruct-v0.1` | Mixtral 8x7B | Great quality |
| `Qwen/Qwen2.5-Coder-7B-Instruct` | Qwen 2.5 Coder 7B | Specialized for coding |

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# HuggingFace API Key (required for HuggingFace provider)
HF_API_KEY=hf_your_api_key_here

# Anthropic API Key (for Claude provider)
ANTHROPIC_API_KEY=sk-ant-your_key_here
```

### Getting a HuggingFace API Key

1. Go to [HuggingFace](https://huggingface.co/)
2. Sign up or log in
3. Go to Settings → Access Tokens
4. Create a new token with "Read" permissions
5. Copy the token (starts with `hf_`)

## Training Data Collection

Successful renderer generations are automatically saved to:
- **Data file**: `training_data/successful_renderers.jsonl`
- **Stats file**: `training_data/stats.json`

### Data Format (JSONL)

Each line is a JSON object:
```json
{
  "id": "train_abc123_xyz789",
  "timestamp": "2025-01-20T10:30:00.000Z",
  "domain": "blocks-world",
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "input": {
    "domainName": "blocks-world",
    "states": [...],
    "stateCount": 5
  },
  "output": {
    "rendererCode": "function renderBlocksWorld(ctx, state) {...}",
    "functionName": "renderBlocksWorld"
  },
  "metadata": {
    "usedMcp": true,
    "generationTimeMs": 15000,
    "codeLength": 2500,
    "validated": true
  }
}
```

### Exporting for Fine-Tuning

The training data collector can export data in instruction fine-tuning format:

```typescript
import { getTrainingDataCollector } from './training-data-collector.js';

const collector = getTrainingDataCollector();
const exportPath = collector.exportForFineTuning();
// Creates: training_data/finetune_dataset.jsonl
```

## Deployment Instructions

### On BGU Server (132.73.84.70)

1. **SSH to the server**:
   ```bash
   ssh ubuntu@132.73.84.70
   ```

2. **Navigate to project directory**:
   ```bash
   cd /home/ubuntu/planning-visualizer
   ```

3. **Pull latest changes** (if using Git):
   ```bash
   git pull origin main
   ```
   
   Or **copy files manually** if Git isn't configured.

4. **Add HuggingFace API key** to `.env`:
   ```bash
   cd backend/api
   echo "HF_API_KEY=hf_your_key_here" >> .env
   ```

5. **Rebuild the application**:
   ```bash
   cd /home/ubuntu/planning-visualizer
   pnpm run build:backend
   pnpm run build:frontend
   ```

6. **Restart the PM2 process**:
   ```bash
   pm2 restart planning-visualizer
   ```

7. **Verify deployment**:
   - Visit: https://planning-visualizer.cs.bgu.ac.il
   - Check that HuggingFace option appears in LLM provider selector

## HuggingFace Free Tier Limitations

- **Rate limits**: ~30 requests/hour for free tier
- **Model loading**: First request may take 20-60 seconds while model loads
- **Timeout**: Large models (34B+) may timeout on free tier
- **Recommendation**: Use CodeLlama 13B or Mistral 7B for best results on free tier

## Future Fine-Tuning

Once you have collected enough training data (50+ examples recommended), you can:

1. Export the data:
   ```typescript
   const collector = getTrainingDataCollector();
   collector.exportForFineTuning('./finetune_data.jsonl');
   ```

2. Use HuggingFace's fine-tuning tools or services like:
   - AutoTrain
   - PEFT/LoRA fine-tuning
   - Full fine-tuning on your own hardware

3. Host the fine-tuned model on HuggingFace Hub

4. Update the model ID in the application to use your fine-tuned model
