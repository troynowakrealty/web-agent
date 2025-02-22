import { AIProvider, ChatMessage } from './types';
import { logger } from '../../utils/logger';
import { ollama } from 'ollama-ai-provider';
import { OpenAI } from 'openai';

interface OllamaError {
  error: string;
  code?: number;
}

export class OllamaProvider implements AIProvider {
  private baseUrl: string;
  private model: string;
  private visionModel: string;

  constructor(baseUrl: string, model: string, visionModel: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.model = model;
    this.visionModel = visionModel;

    logger.log('info', { 
      message: 'Initialized Ollama provider',
      data: {
        baseUrl: this.baseUrl,
        model: this.model,
        visionModel: this.visionModel
      }
    });
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    try {
      logger.log('info', { message: `=== Ollama Chat Request (${this.model}) ===` });
      logger.log('info', { message: 'Messages', data: messages });

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          format: 'json',
          temperature: 0.5,
        }),
      });

      if (!response.ok) {
        const error: OllamaError = await response.json();
        throw new Error(`HTTP error! status: ${response.status}, message: ${error.error}`);
      }

      const data = await response.json();
      logger.log('info', { message: `=== Ollama Chat Response (${this.model}) ===` });
      logger.log('info', { message: 'Response', data: data });

      return data.message.content;
    } catch (error) {
      logger.error({ 
        message: `Ollama chat error (${this.model})`,
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      throw error;
    }
  }

  async chatWithVision(messages: ChatMessage[], imageBase64: string): Promise<string> {
    try {
      logger.log('info', { message: `=== Ollama Vision Chat Request (${this.visionModel}) ===` });
      logger.log('info', { message: 'Messages', data: messages });
      logger.log('info', { message: 'Image provided', data: { hasImage: !!imageBase64 } });

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.visionModel,
          messages: messages.map(msg => {
            if (msg.role === 'user') {
              return {
                role: msg.role,
                content: [
                  { type: 'text', text: msg.content },
                  { type: 'image', image: Buffer.from(imageBase64, 'base64') }
                ]
              };
            }
            return {
              role: msg.role,
              content: msg.content
            };
          }),
          format: 'json',
          temperature: 0.5,
        }),
      });

      if (!response.ok) {
        const error: OllamaError = await response.json();
        throw new Error(`HTTP error! status: ${response.status}, message: ${error.error}`);
      }

      const data = await response.json();
      logger.log('info', { message: `=== Ollama Vision Chat Response (${this.visionModel}) ===` });
      logger.log('info', { message: 'Response', data: data });

      try {
        // Try to parse the response as JSON
        const jsonResponse = JSON.parse(data.message.content);
        return JSON.stringify(jsonResponse);
      } catch (error) {
        logger.log('info', { 
          message: 'Failed to parse JSON response, attempting to extract JSON from text',
          data: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
        // If parsing fails, try to extract JSON from the text
        const jsonMatch = data.message.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return jsonMatch[0];
        }
        // If no JSON found, return a formatted error response
        return JSON.stringify({
          type: "error",
          description: "Failed to get structured response from vision model"
        });
      }
    } catch (error) {
      logger.error({ 
        message: `Ollama vision chat error (${this.visionModel})`,
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      throw error;
    }
  }

  async streamResponse(prompt: string): Promise<Response> {
    try {
      const response = await fetch(this.baseUrl + '/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: true,
        }),
      });

      if (!response.ok) {
        const error: OllamaError = await response.json();
        throw new Error(`HTTP error! status: ${response.status}, message: ${error.error}`);
      }

      return response;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to stream response: ${error.message}`);
      }
      throw new Error('Failed to stream response');
    }
  }

  async generateResponse(prompt: string): Promise<string> {
    try {
      const response = await fetch(this.baseUrl + '/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
        }),
      });

      if (!response.ok) {
        const error: OllamaError = await response.json();
        throw new Error(`HTTP error! status: ${response.status}, message: ${error.error}`);
      }

      const data = await response.json();
      return data.response;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to generate response: ${error.message}`);
      }
      throw new Error('Failed to generate response');
    }
  }
} 