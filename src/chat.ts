import { ChatGPTAPI } from 'chatgpt';
import { OpenAIClient, AzureKeyCredential, ChatCompletions }  from '@azure/openai';

export class Chat {
  private openAIClient: ChatGPTAPI | undefined;
  private azureOpenAIClient: OpenAIClient | undefined;
  private deploymentId = process.env.MODEL || 'gpt-3.5-turbo';

  constructor(apikey: string) {
    if (process.env.OPENAI_API_KEY) {
      this.openAIClient = new ChatGPTAPI({
        apiKey: apikey,
        apiBaseUrl:
          process.env.OPENAI_API_ENDPOINT || 'https://api.openai.com/v1',
        completionParams: {
          model: this.deploymentId,
          temperature: +(process.env.temperature || 0) || 1,
          top_p: +(process.env.top_p || 0) || 1,
          max_tokens: process.env.max_tokens
            ? +process.env.max_tokens
            : undefined,
        },
      });
    } else if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
      this.azureOpenAIClient = new OpenAIClient(process.env.AZURE_OPENAI_ENDPOINT, new AzureKeyCredential(process.env.AZURE_OPENAI_API_KEY));
    }
  }

  private generateSystemPrompt = () => {
    const answerLanguage = process.env.LANGUAGE
      ? `Answer me in ${process.env.LANGUAGE},`
      : '';

    const prompt =
      process.env.PROMPT ||
        'Below is a code patch, please help me do a brief code review on it. Any bug risks and/or improvement suggestions are welcome:';

    return `${prompt}, ${answerLanguage}`;
  };

  public codeReview = async (patch: string) => {
    if (!patch) {
      return '';
    }

    console.time('code-review cost');
    const systemPrompt = this.generateSystemPrompt();
    if (process.env.OPENAI_API_KEY && this.openAIClient) {
      const prompt = `${systemPrompt}:\n\n${patch}`;
      const res = await this.openAIClient.sendMessage(prompt);
      console.timeEnd('code-review cost');
      return res.text;
    } else if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT && this.azureOpenAIClient) {
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: patch }
      ];    
      const result: ChatCompletions = await this.azureOpenAIClient.getChatCompletions(this.deploymentId, messages);
      
      console.timeEnd('code-review cost');
      return result.choices[0].message?.content;
    } else {
      console.timeEnd('cannot find api key');
      return '';
    }
  };
}
