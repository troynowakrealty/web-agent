import { AIProvider, ChatMessage } from './types';
import { logger } from '../../utils/logger';
import { ollama } from 'ollama-ai-provider';
import { generateText } from 'ai';

export class OllamaProvider implements AIProvider {
  private baseUrl: string;
  private model: string;
  private visionModel: string;

  constructor(baseUrl: string, model: string, visionModel: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.model = model;
    this.visionModel = visionModel;

    logger.log('Initialized Ollama provider:', {
      baseUrl: this.baseUrl,
      model: this.model,
      visionModel: this.visionModel
    });
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    try {
      logger.log(`\n=== Ollama Chat Request (${this.model}) ===`);
      logger.log('Messages:', messages);

      const result = await generateText({
        model: ollama(this.model),
        messages: messages as any,
        maxTokens: 1024,
        temperature: 0.3,
      });

      logger.log(`\n=== Ollama Chat Response (${this.model}) ===`);
      logger.log('Response:', result);
      
      return result.text;
    } catch (error) {
      logger.error(`Ollama chat error (${this.model}):`, error);
      throw error;
    }
  }

  async chatWithVision(messages: ChatMessage[], imageBase64: string): Promise<string> {
    try {
      logger.log(`\n=== Ollama Vision Chat Request (${this.visionModel}) ===`);
      logger.log('Messages:', messages);
      logger.log('Image provided:', !!imageBase64);

      // Convert messages to include image for vision model
      const messagesWithImage = messages.map(msg => {
        if (msg.role === 'user') {
          return {
            ...msg,
            content: Array.isArray(msg.content) ? msg.content : [
              { type: 'text', text: msg.content },
              { type: 'image', image: Buffer.from(imageBase64, 'base64') }
            ]
          };
        }
        return msg;
      });

      const result = await generateText({
        model: ollama(this.visionModel),
        messages: messagesWithImage as any,
        maxTokens: 1024,
        temperature: 0.3,
      });

      logger.log(`\n=== Ollama Vision Chat Response (${this.visionModel}) ===`);
      logger.log('Response:', result);

      return result.text;
    } catch (error) {
      logger.error(`Ollama vision chat error (${this.visionModel}):`, error);
      throw error;
    }
  }
} 