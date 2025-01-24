import { AIConfig, AIProvider } from './types';
import { OpenAIProvider } from './openai-provider';
import { OllamaProvider } from './ollama-provider';

export class AIProviderFactory {
  static createProvider(config: AIConfig): AIProvider {
    switch (config.provider) {
      case 'openai':
        if (!config.openai?.apiKey) {
          throw new Error('OpenAI API key is required');
        }
        return new OpenAIProvider(
          config.openai.apiKey,
          config.openai.model || 'gpt-4',
          config.openai.visionModel || 'gpt-4-vision-preview'
        );
      
      case 'ollama':
        if (!config.ollama?.baseUrl) {
          throw new Error('Ollama base URL is required');
        }
        return new OllamaProvider(
          config.ollama.baseUrl,
          config.ollama.model || 'mistral',
          config.ollama.visionModel || 'llava'
        );
      
      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  }
} 