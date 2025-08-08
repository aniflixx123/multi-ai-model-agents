// Model configuration types
export interface ModelConfig {
  modelName: string;
  maxTokens?: number;
  temperature?: number;
  [key: string]: any;
}

export interface ModelInput {
  text: string;
  audio?: ArrayBuffer;
  audioStream?: ReadableStream;
  stream?: boolean;
  operation?: string;
  context?: any;
  source?: string;
  topK?: number;
  threshold?: number;
  numClusters?: number;
}

export interface ModelResponse {
  text?: string;
  embeddings?: number[][];
  searchResults?: SearchResult[];
  clusters?: Cluster[];
  insights?: any;
  confidence: number;
  metadata: any;
  modelId: string;
  timestamp: number;
}

export interface CachedResponse {
  response: ModelResponse;
  timestamp: number;
}

export interface ModelMetrics {
  record(metrics: any): void;
  getRecentSuccessRate(): number;
  recordCacheHit(): void;
}