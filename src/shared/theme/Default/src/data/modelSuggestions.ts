import type { DeskMode } from '../types/settings';

export interface SuggestionRow {
  task: string;
  local: { name: string; note: string };
  download: { name: string; size: string };
  online: { name: string; provider: string };
}

export const modelSuggestions: Record<DeskMode, SuggestionRow[]> = {
  super: [
    { task: 'Everyday chat', local: { name: 'ASI AMS Micro 70M', note: 'Router recipe until GGUF on disk' }, download: { name: 'Qwen2.5-1.5B-Instruct', size: 'HF or Ollama' }, online: { name: 'gpt-4o-mini', provider: 'OpenAI / OpenRouter' } },
    { task: 'Planning', local: { name: 'ASI AMS Hybrid 120M', note: 'Optional larger router' }, download: { name: 'Phi-3-mini-4k-instruct', size: 'HF or Ollama' }, online: { name: 'claude-3-5-haiku', provider: 'Anthropic / OpenRouter' } },
    { task: 'Reading & notes', local: { name: 'nomic-embed-text', note: 'If pulled in Ollama' }, download: { name: 'Llama-3.2-3B-Instruct', size: 'HF or Ollama' }, online: { name: 'gemini-2.0-flash', provider: 'Google AI' } },
  ],
  multi: [
    { task: 'Group decisions', local: { name: 'ASI AMS Micro 70M', note: 'Council local router' }, download: { name: 'Mistral-7B-Instruct-v0.3', size: 'HF or Ollama' }, online: { name: 'gpt-4o', provider: 'OpenAI / OpenRouter' } },
    { task: 'Research', local: { name: 'ASI AMS Hybrid 120M', note: 'Longer local notes' }, download: { name: 'Qwen2.5-1.5B-Instruct', size: 'HF or Ollama' }, online: { name: 'claude-3-5-sonnet', provider: 'Anthropic / OpenRouter' } },
    { task: 'Drafting', local: { name: 'ASI AMS Hybrid 120M', note: 'Optional larger router · recipe until GGUF' }, download: { name: 'Phi-3-mini-4k-instruct', size: 'HF or Ollama' }, online: { name: 'gemini-1.5-flash', provider: 'Google AI' } },
  ],
  pro: [
    { task: 'Domain expert', local: { name: 'ASI AMS Micro 70M', note: 'Pro local router slot' }, download: { name: 'Mistral-7B-Instruct-v0.3', size: 'HF or Ollama' }, online: { name: 'gpt-4o', provider: 'OpenAI / OpenRouter' } },
    { task: 'Coding', local: { name: 'Ollama / GGUF scan', note: 'Code-capable GGUF' }, download: { name: 'Qwen2.5-1.5B-Instruct', size: 'HF or Ollama' }, online: { name: 'deepseek-coder', provider: 'OpenRouter / DeepSeek' } },
    { task: 'Analysis', local: { name: 'LLaVA (vision)', note: 'If pulled — images' }, download: { name: 'Llama-3.2-3B-Instruct', size: 'HF or Ollama' }, online: { name: 'gemini-2.0-flash', provider: 'Google AI' } },
  ],
};
