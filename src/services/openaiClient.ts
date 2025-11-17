export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  useDefaultTemperature?: boolean;
}

export interface ChatCompletionResult {
  content: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export class OpenAIClient {
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  async createChatCompletion(messages: ChatMessage[], options: ChatCompletionOptions = {}): Promise<ChatCompletionResult> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        ...(options.useDefaultTemperature ? {} : { temperature: options.temperature ?? 0.2 }),
        max_completion_tokens: options.maxTokens ?? 512
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI request failed: ${response.status} ${text}`);
    }

    const payload = (await response.json()) as {
      choices: Array<{
        message?: {
          content?:
            | string
            | Array<{ type?: string; text?: string; content?: string | Array<{ text?: string }> }>
            | { type?: string; text?: string; content?: string | Array<{ text?: string }> };
        };
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const rawContent = payload.choices[0]?.message?.content;
    const textResult = this.extractTextContent(rawContent);
    if (!textResult) {
      throw new Error('OpenAI response missing content');
    }
    return {
      content: textResult.trim(),
      promptTokens: payload.usage?.prompt_tokens,
      completionTokens: payload.usage?.completion_tokens,
      totalTokens: payload.usage?.total_tokens
    };
  }

  private extractTextContent(content: unknown): string | null {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      const joined = content
        .map((entry) => {
          if (!entry) {
            return '';
          }
          if (typeof entry === 'string') {
            return entry;
          }
          if (typeof entry === 'object') {
            const maybeObject = entry as { text?: string; content?: unknown };
            return (
              maybeObject.text ||
              (typeof maybeObject.content === 'string'
                ? maybeObject.content
                : this.extractTextContent(maybeObject.content)) ||
              ''
            );
          }
          return '';
        })
        .join('')
        .trim();
      return joined || null;
    }
    if (content && typeof content === 'object') {
      const data = content as { text?: string; content?: unknown };
      return (
        data.text ||
        (typeof data.content === 'string'
          ? data.content
          : data.content
          ? this.extractTextContent(data.content)
          : null)
      );
    }
    return null;
  }
}
