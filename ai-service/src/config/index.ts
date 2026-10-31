import dotenv from 'dotenv';
dotenv.config();

export interface AiConfig {
  port: number;
  nodeEnv: string;
  geminiApiKey: string;
  geminiModel: string;
  geminiEmbeddingModel: string;
  huggingFaceApiKey: string;
  huggingFaceModel: string;
  huggingFaceBaseUrl: string;
  backendApiUrl: string;
  knowledgeBaseUrl: string;
}

export const config: AiConfig = {
  port: parseInt(process.env.PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || process.env.GEMINI_EMBEDDINGS_MODEL || 'gemini-embedding-001',
  huggingFaceApiKey: process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN || '',
  huggingFaceModel: process.env.HUGGINGFACE_MODEL || process.env.HF_MODEL || 'meta-llama/Llama-3.1-8B-Instruct',
  huggingFaceBaseUrl: process.env.HUGGINGFACE_BASE_URL || 'https://router.huggingface.co/v1/chat/completions',
  backendApiUrl: process.env.BACKEND_API_URL || process.env.BACKEND_URL || 'http://localhost:5000/api/v1',
  knowledgeBaseUrl: process.env.KNOWLEDGE_BASE_URL || ''
};
