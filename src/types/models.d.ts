// src/types/models.d.ts
// Core type definitions for the AI models system

// ============================================
// CORE MODEL TYPES
// ============================================

export interface ModelConfig {
  modelName: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  responseStyle?: string;
  enableRAG?: boolean;
  industrySpecialization?: boolean;
  dimensions?: number;
  maxBatchSize?: number;
  similarityThreshold?: number;
  indexType?: string;
  enableClustering?: boolean;
  maxAudioLength?: number;
  supportedFormats?: string[];
  optimalSampleRate?: number;
  enableVAD?: boolean;
  enableDiarization?: boolean;
  enablePunctuation?: boolean;
  maxConcurrency?: number;
  chunkSize?: number;
  streamingEnabled?: boolean;
  latencyTarget?: number;
  accuracyTradeoff?: number;
  reasoningDepth?: number;
  enableCoT?: boolean;
  enableToT?: boolean;
  enableSelfConsistency?: boolean;
  beamSearch?: boolean;
  topK?: number;
  topP?: number;
  targetGradeLevel?: number;
  useAnalogies?: boolean;
  avoidJargon?: boolean;
  cacheAggressively?: boolean;
  useTemplates?: boolean;
  enableEmoji?: boolean;
  enableSlang?: boolean;
  enableCodeGeneration?: boolean;
  enableDiagramming?: boolean;
  languages?: string[];
  enableLinting?: boolean;
  enableSecurityScan?: boolean;
  enablePerformanceAnalysis?: boolean;
  optimalLatency?: number;
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
  processingTime?: number;
  tokenCount?: number;
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

// ============================================
// AUDIO PROCESSING TYPES
// ============================================

export interface TranscriptionResult {
  text: string;
  words?: Word[];
  segments?: Segment[];
  confidence: number;
  avg_logprob?: number;
  no_speech_prob?: number;
}

export interface Word {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface Segment {
  text: string;
  start: number;
  end: number;
  no_speech_prob: number;
}

export interface Speaker {
  id: string;
  segments: Segment[];
}

export interface AudioQuality {
  snr: number;
  clarity: number;
  volume: number;
  clipping: boolean;
  quality: string;
}

// ============================================
// REASONING & ANALYSIS TYPES
// ============================================

export interface Problem {
  statement: string;
  constraints: string[];
  context?: any;
}

export interface Knowledge {
  context: string;
  facts: string[];
  relationships: any[];
}

export interface ReasoningPath {
  steps: string[];
  confidence: number;
  assumptions?: string[];
}

export interface ComplexityAssessment {
  cognitive: number;
  computational: number;
  domain: number;
  overall: number;
}

// ============================================
// SALES & BUSINESS TYPES
// ============================================

export interface ConversationContext {
  company: string;
  dealSize: string;
  stakeholders: string[];
  timeline: string;
  industry: string;
  stage?: string;
}

export interface SalesStrategy {
  type: string;
  objective: string;
  approach: string;
  keyPoints: string[];
  nextStep: string;
  includeSocialProof?: boolean;
  createUrgency?: boolean;
  focus: string;
}

export interface IndustryContext {
  name: string;
  keyTechnologies: string[];
  mainChallenges: string[];
  competitors: string[];
  valueProps: string[];
}

export interface ProfessionalResponse {
  text: string;
  confidence: number;
  techniques: string[];
  insights: string[];
  nextSteps: string[];
  objections: string[];
}

// ============================================
// TECHNICAL TYPES
// ============================================

export interface TechnicalContext {
  requirements: string[];
  constraints: string[];
  techStack: string[];
  systems: string[];
}

export interface Solution {
  architecture: any;
  integrations: Integration[];
  implementation: any;
  estimatedEffort: number;
  riskAssessment: any;
}

export interface Integration {
  name: string;
  type: string;
  complexity: string;
}

export interface TechnicalResponse {
  text: string;
  confidence: number;
  depth: string;
  code?: string[];
  architecture?: any;
  integrations?: Integration[];
  metrics?: any;
}

export interface CodeContext {
  task: string;
  language: string;
  requirements: string[];
  constraints: string[];
  projectType: string;
  scale: string;
  performanceRequirements: string;
}

export interface CodeSolution {
  code: string;
  explanation: string;
  complexity: string;
  language: string;
  confidence: number;
  tests?: string;
  docs?: string;
}

// ============================================
// SIMPLE EXPLANATION TYPES
// ============================================

export interface SimpleExplanation {
  text: string;
  confidence: number;
  analogies: string[];
  simplificationLevel: string;
  keyPoints: string[];
}

// ============================================
// TEMPLATE TYPES
// ============================================

export interface Template {
  id: string;
  pattern: RegExp;
  generate(input: string): string;
}

// ============================================
// VECTOR & SEARCH TYPES
// ============================================

export interface SearchResult {
  text: string;
  score: number;
  metadata?: any;
}

export interface Cluster {
  id: string;
  centroid: number[];
  members: any[];
}

export interface EmbeddingRecord {
  id: string;
  vector: number[];
  metadata: any;
}

export interface ClusterInsights {
  dominantThemes: string[];
  outliers: any[];
  density: number;
  separation: number;
  quality: number;
}