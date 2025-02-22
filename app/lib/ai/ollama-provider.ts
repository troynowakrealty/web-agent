import { AIProvider, ChatMessage } from './types';
import { logger } from '../../utils/logger';
import { ollama } from 'ollama-ai-provider';
import { generateText, tool } from 'ai';
import type { CoreMessage, CoreUserMessage, TextPart, ImagePart } from 'ai';
import { z } from 'zod';

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

      const result = await generateText({
        model: ollama(this.model),
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })) as CoreMessage[],
        temperature: 0.5,
        maxTokens: 1024,
        tools: {
          agentResponse: tool({
            parameters: z.object({
              type: z.string(),
              description: z.string(),
              url: z.string().optional(),
            }),
            execute: async (args) => args,
          }),
        },
      });

      logger.log('info', { message: `=== Ollama Chat Response (${this.model}) ===` });
      logger.log('info', { message: 'Response', data: result });
      
      // Extract the tool result if available, otherwise use the raw text
      if (result.toolResults && result.toolResults.length > 0) {
        const toolResult = result.toolResults[0];
        return JSON.stringify(toolResult.result);
      }
      
      return result.text;
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

      // Convert messages to include image for vision model
      const messagesWithImage = messages.map(msg => {
        if (msg.role === 'user') {
          const content: (TextPart | ImagePart)[] = [
            { type: 'text', text: typeof msg.content === 'string' ? msg.content + '\nIMPORTANT: Respond ONLY with a JSON object in the format: { "type": string, "description": string, "url"?: string }' : '' },
            { type: 'image', image: Buffer.from(imageBase64, 'base64') }
          ];
          return {
            role: msg.role,
            content
          } as CoreUserMessage;
        }
        return {
          role: msg.role,
          content: msg.content
        } as CoreMessage;
      });

      const result = await generateText({
        model: ollama(this.visionModel),
        messages: messagesWithImage,
        maxTokens: 1024,
        temperature: 0.5,
      });

      logger.log('info', { message: `=== Ollama Vision Chat Response (${this.visionModel}) ===` });
      logger.log('info', { message: 'Response', data: result });

      try {
        // Try to parse the response as JSON
        const jsonResponse = JSON.parse(result.text);
        return JSON.stringify(jsonResponse);
      } catch (error) {
        logger.log('info', { 
          message: 'Failed to parse JSON response, attempting to extract JSON from text',
          data: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
        // If parsing fails, try to extract JSON from the text
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
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