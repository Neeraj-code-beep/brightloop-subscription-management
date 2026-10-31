import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './server.js';
import { BackendApiClient, BackendMockHandler } from './backendClient.js';
import { McpToolDefinition } from './tools/billingTools.js';
import { AuthIdentity } from '../auth/identityResolver.js';

export class McpBillingClient {
  private client: Client;
  private serverTransport: any;
  private clientTransport: any;
  private initPromise: Promise<void>;
  private isClosed = false;

  constructor(jwtToken?: string, mockHandler?: BackendMockHandler, identity?: AuthIdentity) {
    const backendClient = new BackendApiClient(jwtToken, mockHandler);
    const server = createMcpServer(backendClient, identity);

    const clientInstance = new Client(
      {
        name: 'brightloop-ai-assistant',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );
    this.client = clientInstance;

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    this.clientTransport = clientTransport;
    this.serverTransport = serverTransport;

    this.initPromise = (async () => {
      try {
        await server.connect(serverTransport);
        await clientInstance.connect(clientTransport);
      } catch (err) {
        if (!this.isClosed) {
          throw err;
        }
      }
    })();
  }

  async ensureConnected() {
    if (this.isClosed) return;
    await this.initPromise;
  }

  async listTools(): Promise<McpToolDefinition[]> {
    await this.ensureConnected();
    const result = await this.client.listTools();
    return (result.tools || []) as McpToolDefinition[];
  }

  async callTool(name: string, args: Record<string, any> = {}): Promise<{
    isError?: boolean;
    rawText: string;
    data: any;
  }> {
    await this.ensureConnected();
    const result = await this.client.callTool({
      name,
      arguments: args
    });

    const contentList = Array.isArray(result.content) ? result.content : [];
    const contentItem = contentList[0] as any;
    let rawText = '';
    let parsedData: any = null;

    if (contentItem && contentItem.type === 'text') {
      rawText = contentItem.text;
      try {
        parsedData = JSON.parse(rawText);
      } catch {
        parsedData = rawText;
      }
    }

    return {
      isError: Boolean(result.isError) || (parsedData && parsedData.error === true),
      rawText,
      data: parsedData
    };
  }

  async close() {
    this.isClosed = true;
    try {
      await this.initPromise;
    } catch {
      // Ignored
    }
    try {
      await this.client.close();
    } catch {
      // Ignored
    }
    try {
      if (this.clientTransport) await this.clientTransport.close();
    } catch {
      // Ignored
    }
    try {
      if (this.serverTransport) await this.serverTransport.close();
    } catch {
      // Ignored
    }
  }
}
