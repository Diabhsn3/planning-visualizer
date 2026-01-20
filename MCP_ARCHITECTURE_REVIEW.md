# Planning Visualizer: MCP Architecture & LLM Approaches Review

## Executive Summary

This document provides a comprehensive review of the planning-visualizer's MCP (Model Context Protocol) architecture, evaluates potential Hugging Face improvements, and compares three approaches for generating visualizations: Claude API, Ollama (local LLMs), and Text-to-Image generation.

---

## 1. Current MCP Architecture Analysis

### 1.1 Architecture Overview

The planning-visualizer uses a **three-tier architecture** for LLM-based renderer generation:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend API    │────▶│   MCP Server    │
│   (React/TS)    │     │   (Node.js/TS)   │     │   (Python)      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │   LLM Provider   │
                        │ (Claude/Ollama)  │
                        └──────────────────┘
```

### 1.2 MCP Server Components

**Location:** `mcp_server/mcp_server.py`

The MCP server exposes **2 tools** to the LLM:

| Tool | Purpose | Key Features |
|------|---------|--------------|
| `analyze_domain_states` | Analyzes PDDL states and provides domain-specific hints | State analysis, domain detection, action insights, visual feedback suggestions |
| `validate_renderer` | Validates generated JavaScript code | Syntax checking, function name validation, trailing text detection |

### 1.3 MCP Client Integration

**Location:** `backend/api/mcp-client.ts`

The MCP client:
- Connects to Python MCP server via **stdio transport**
- Supports **tool discovery** and **tool calling**
- Supports **resource reading** for versioned prompts
- Has **sampling capability** for server-initiated LLM requests

### 1.4 LLM Orchestrator

**Location:** `backend/api/llm-orchestrator.ts`

The orchestrator provides:
- **Provider abstraction** via `LLMProvider` interface
- **Two implementations**: `AnthropicProvider` and `OllamaProvider`
- **Multi-step generation** with MCP tool integration
- **Retry logic** with validation

### 1.5 Strengths of Current Architecture

1. **Clean separation of concerns** - MCP server handles domain logic, backend handles orchestration
2. **Provider-agnostic design** - Easy to add new LLM providers
3. **Tool-based approach** - LLM can request domain analysis and code validation
4. **Versioned prompts** - System prompts stored as MCP resources

### 1.6 Areas for Improvement

1. **Single MCP server** - Could benefit from multiple specialized servers
2. **Limited tool set** - Only 2 tools, could add more (e.g., example retrieval, style templates)
3. **No caching** - Each generation starts fresh, no learning from past successes
4. **Synchronous processing** - Could benefit from streaming responses

---

## 2. Hugging Face Integration Opportunities

### 2.1 Available HF MCP Tools

The Hugging Face MCP server provides:

| Tool | Use Case |
|------|----------|
| `model_search` | Find models by task, library, popularity |
| `dataset_search` | Find training datasets |
| `paper_search` | Research latest techniques |
| `space_search` | Find hosted demos/APIs |
| `gr1_z_image_turbo_generate` | Generate images via Z-Image model |

### 2.2 Potential Improvements with HF

#### A. Code Generation Models

| Model | Size | Strengths | Limitations |
|-------|------|-----------|-------------|
| CodeLlama (via Ollama) | 7B-34B | Good at JavaScript, runs locally | Requires GPU/RAM |
| DeepSeek Coder | 6.7B-33B | Excellent code quality | Larger models need more resources |
| Qwen 2.5 Coder | 7B-32B | Strong reasoning | Newer, less tested |

**Recommendation:** Continue using Ollama with CodeLlama/DeepSeek for local inference.

#### B. Text-to-Image Models

| Model | Downloads | Task | Suitability |
|-------|-----------|------|-------------|
| Stable Diffusion XL | 1.8M | text-to-image | High - can generate visualization concepts |
| Stable Diffusion 3.5 | 87K | text-to-image | High - better prompt understanding |
| Z-Image Turbo (MCP) | N/A | text-to-image | Medium - available via MCP tool |

**Note:** Text-to-image is NOT suitable for generating functional code renderers. It could be used for:
- Generating background textures
- Creating icon/sprite assets
- Concept art for visualization styles

---

## 3. Three Approaches Comparison

### 3.1 Approach 1: Claude API (Current Default)

**How it works:**
1. Send state data + system prompt to Claude
2. Claude generates JavaScript renderer code
3. MCP tools provide domain hints and validation
4. Code is executed in browser canvas

**Pros:**
- ✅ Highest code quality and reasoning
- ✅ Best understanding of complex prompts
- ✅ Reliable JSON/code output formatting
- ✅ Strong context handling (200K tokens)

**Cons:**
- ❌ Requires API key ($)
- ❌ Internet dependency
- ❌ Rate limits
- ❌ Privacy concerns (data sent to cloud)

**Cost:** ~$3-15 per 1M tokens (depending on model)

**Best for:** Production use, complex domains, high-quality output

---

### 3.2 Approach 2: Ollama (Local LLMs)

**How it works:**
1. Run Ollama server locally
2. Send state data to local model (CodeLlama, Mistral, etc.)
3. Model generates JavaScript code
4. Same MCP validation pipeline

**Pros:**
- ✅ Completely free
- ✅ No internet required
- ✅ Full privacy (data stays local)
- ✅ No rate limits
- ✅ Can fine-tune models

**Cons:**
- ❌ Requires GPU/RAM (8GB+ recommended)
- ❌ Lower code quality than Claude
- ❌ Slower inference
- ❌ May struggle with complex prompts
- ❌ Less reliable output formatting

**Cost:** Free (hardware costs only)

**Best for:** Development, testing, privacy-sensitive deployments, offline use

**Recommended Models:**
| Model | RAM Needed | Quality | Speed |
|-------|------------|---------|-------|
| codellama:7b | 8GB | Good | Fast |
| codellama:13b | 16GB | Better | Medium |
| codellama:34b | 32GB | Best | Slow |
| deepseek-coder:6.7b | 8GB | Good | Fast |
| mixtral:8x7b | 32GB | Excellent | Slow |

---

### 3.3 Approach 3: Text-to-Image Generation

**How it works:**
1. Describe desired visualization in natural language
2. Generate image using Stable Diffusion / DALL-E
3. Display static image instead of interactive canvas

**Pros:**
- ✅ Beautiful, artistic visualizations
- ✅ No code generation needed
- ✅ Works for any domain without templates
- ✅ Can generate unique visual styles

**Cons:**
- ❌ **NOT INTERACTIVE** - can't animate plan steps
- ❌ **NOT PRECISE** - can't show exact state data
- ❌ No zoom/pan functionality
- ❌ Can't highlight specific objects
- ❌ Each state requires new image generation (slow)
- ❌ Inconsistent visual style between frames

**Cost:** 
- Stable Diffusion (local): Free but needs GPU
- DALL-E API: ~$0.04-0.08 per image
- Midjourney: Subscription required

**Best for:** 
- **NOT recommended for this project**
- Could be used for: generating background textures, icons, concept art

---

## 4. Recommendation Matrix

| Criteria | Claude | Ollama | Text-to-Image |
|----------|--------|--------|---------------|
| Code Quality | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | N/A |
| Cost | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Privacy | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Speed | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Interactivity | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ |
| Offline Use | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Setup Complexity | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

### Final Recommendations

1. **For Production:** Use **Claude** with fallback to **Ollama**
2. **For Development/Testing:** Use **Ollama** with CodeLlama 13B
3. **For Offline/Privacy:** Use **Ollama** exclusively
4. **Text-to-Image:** **Not recommended** for core visualization - only for assets

---

## 5. Proposed Architecture Improvements

### 5.1 Short-term Improvements

1. **Add model caching** - Cache successful renderers by domain+state hash
2. **Implement streaming** - Show generation progress to user
3. **Add more MCP tools:**
   - `get_example_renderer` - Retrieve working examples
   - `get_style_template` - Get CSS/visual style templates
   - `suggest_improvements` - Analyze and improve existing code

### 5.2 Medium-term Improvements

1. **Fine-tune local model** - Train CodeLlama on successful renderer examples
2. **Add HF Inference API** - Use HF's hosted models as third option
3. **Implement A/B testing** - Compare Claude vs Ollama output quality

### 5.3 Long-term Vision

1. **Hybrid approach** - Use Claude for initial generation, Ollama for iterations
2. **Self-improving system** - Learn from user feedback on generated renderers
3. **Multi-modal input** - Accept sketches/images as visualization hints

---

## 6. Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Claude Provider | ✅ Complete | Default provider |
| Ollama Provider | ✅ Complete | Added in latest update |
| Provider Selection UI | ✅ Complete | Dropdown in frontend |
| MCP Tool Integration | ✅ Complete | 2 tools available |
| HF Integration | ❌ Not Started | Could add via MCP |
| Text-to-Image | ❌ Not Recommended | Not suitable for interactive viz |

---

## Appendix A: Environment Setup

### Claude Setup
```bash
export ANTHROPIC_API_KEY="your-key-here"
```

### Ollama Setup
```bash
# Install
curl -fsSL https://ollama.com/install.sh | sh

# Pull model
ollama pull codellama:13b

# Start server
ollama serve
```

### Running the Application
```bash
# Backend
cd backend/api && pnpm run dev

# Frontend  
cd frontend && pnpm run dev

# MCP Server (started automatically by backend)
```

---

*Document generated: January 2026*
*Author: Planning Visualizer Development Team*
