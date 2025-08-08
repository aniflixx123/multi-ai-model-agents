// ============================================
// BASE MODEL ARCHITECTURE - FOUNDATION
// ============================================

// BaseModel.ts - Abstract foundation for all models
export abstract class BaseModel {
  protected modelId: string;
  protected config: ModelConfig;
  protected metrics: ModelMetrics;
  protected cache: Map<string, CachedResponse>;
  protected performanceOptimizer: PerformanceOptimizer;
  protected costTracker: CostTracker;
  
  constructor(modelId: string, config: ModelConfig) {
    this.modelId = modelId;
    this.config = config;
    this.metrics = new ModelMetrics(modelId);
    this.cache = new Map();
    this.performanceOptimizer = new PerformanceOptimizer(config);
    this.costTracker = new CostTracker(modelId);
  }

  // Core execution with automatic optimization
  async execute(input: ModelInput): Promise<ModelResponse> {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey(input);
    
    // Intelligent caching
    if (this.shouldUseCache(input) && this.cache.has(cacheKey)) {
      this.metrics.recordCacheHit();
      return this.cache.get(cacheKey)!.response;
    }

    try {
      // Pre-processing optimization
      const optimizedInput = await this.performanceOptimizer.optimize(input);
      
      // Execute with retry logic and circuit breaking
      const response = await this.executeWithResilience(optimizedInput);
      
      // Post-processing and quality enhancement
      const enhancedResponse = await this.enhanceResponse(response);
      
      // Cache management
      this.updateCache(cacheKey, enhancedResponse);
      
      // Metrics and cost tracking
      const executionTime = performance.now() - startTime;
      this.recordMetrics(executionTime, input, enhancedResponse);
      
      return enhancedResponse;
    } catch (error) {
      return this.handleError(error, input);
    }
  }

  protected abstract processInternal(input: ModelInput): Promise<ModelResponse>;
  
  protected async executeWithResilience(input: ModelInput): Promise<ModelResponse> {
    const circuitBreaker = new CircuitBreaker(this.modelId);
    const retryPolicy = new ExponentialBackoffRetry(3, 100);
    
    return circuitBreaker.execute(async () => {
      return retryPolicy.execute(async () => {
        return this.processInternal(input);
      });
    });
  }

  protected enhanceResponse(response: ModelResponse): ModelResponse {
    return {
      ...response,
      modelId: this.modelId,
      timestamp: Date.now(),
      confidence: this.calculateConfidence(response),
      metadata: this.enrichMetadata(response)
    };
  }

  protected calculateConfidence(response: ModelResponse): number {
    // Advanced confidence calculation based on multiple factors
    const factors = [
      response.processingTime < this.config.optimalLatency ? 0.2 : 0,
      response.tokenCount < this.config.maxTokens * 0.8 ? 0.2 : 0.1,
      this.metrics.getRecentSuccessRate() * 0.3,
      this.validateResponseQuality(response) * 0.3
    ];
    return Math.min(factors.reduce((a, b) => a + b, 0), 1.0);
  }

  protected validateResponseQuality(response: ModelResponse): number {
    // Quality scoring logic
    const checks = [
      response.text.length > 10,
      !response.text.includes('error'),
      response.text.split(' ').length > 3,
      /[.!?]$/.test(response.text.trim())
    ];
    return checks.filter(Boolean).length / checks.length;
  }

  protected generateCacheKey(input: ModelInput): string {
    return crypto.subtle.digest('SHA-256', 
      new TextEncoder().encode(JSON.stringify(input))
    ).then(hash => btoa(String.fromCharCode(...new Uint8Array(hash))));
  }

  protected recordMetrics(executionTime: number, input: ModelInput, response: ModelResponse): void {
    this.metrics.record({
      executionTime,
      inputTokens: this.countTokens(input.text),
      outputTokens: this.countTokens(response.text),
      success: true,
      confidence: response.confidence,
      cost: this.costTracker.calculate(input, response)
    });
  }

  protected countTokens(text: string): number {
    // Sophisticated token counting
    return Math.ceil(text.length / 4);
  }
}

// ============================================
// MODEL 1: WHISPER LARGE - PRIMARY TRANSCRIPTION
// ============================================

export class WhisperLarge extends BaseModel {
  private audioProcessor: AdvancedAudioProcessor;
  private noiseReducer: NoiseReductionEngine;
  private languageDetector: LanguageDetector;
  private speakerDiarization: SpeakerDiarization;
  
  constructor() {
    super('whisper-large-v3', {
      modelName: '@cf/openai/whisper-large-v3',
      maxAudioLength: 30000, // 30 seconds
      supportedFormats: ['wav', 'mp3', 'webm', 'flac'],
      optimalSampleRate: 16000,
      enableVAD: true, // Voice Activity Detection
      enableDiarization: true,
      enablePunctuation: true,
      maxConcurrency: 5
    });
    
    this.audioProcessor = new AdvancedAudioProcessor();
    this.noiseReducer = new NoiseReductionEngine();
    this.languageDetector = new LanguageDetector();
    this.speakerDiarization = new SpeakerDiarization();
  }

  async processInternal(input: ModelInput): Promise<ModelResponse> {
    const audio = input.audio!;
    
    // Advanced audio preprocessing
    const processed = await this.preprocessAudio(audio);
    
    // Parallel processing for speed
    const [transcription, language, speakers] = await Promise.all([
      this.transcribe(processed),
      this.languageDetector.detect(processed),
      this.config.enableDiarization ? this.speakerDiarization.identify(processed) : null
    ]);

    return {
      text: this.enhanceTranscription(transcription, speakers),
      confidence: this.calculateTranscriptionConfidence(transcription),
      metadata: {
        language,
        speakers: speakers?.map(s => s.id),
        audioQuality: this.assessAudioQuality(audio),
        processingTime: performance.now()
      },
      modelId: this.modelId,
      timestamp: Date.now()
    };
  }

  private async preprocessAudio(audio: ArrayBuffer): Promise<ArrayBuffer> {
    // Chain of audio enhancements
    let processed = audio;
    
    // Noise reduction using spectral subtraction
    processed = await this.noiseReducer.reduce(processed, {
      algorithm: 'spectral_subtraction',
      aggressiveness: 0.7
    });
    
    // Normalize audio levels
    processed = await this.audioProcessor.normalize(processed, {
      targetLUFS: -16,
      truePeak: -1
    });
    
    // Enhance speech frequencies
    processed = await this.audioProcessor.enhanceSpeech(processed, {
      boostFrequencies: [1000, 3000], // Hz - speech clarity range
      boostAmount: 3 // dB
    });
    
    return processed;
  }

  private async transcribe(audio: ArrayBuffer): Promise<TranscriptionResult> {
    const response = await AI.run(this.config.modelName, {
      audio: Array.from(new Uint8Array(audio)),
      options: {
        temperature: 0.1, // Low for accuracy
        beam_size: 10, // Higher for better accuracy
        best_of: 5,
        vad_filter: true,
        vad_threshold: 0.6,
        language: 'en', // Can be dynamic
        task: 'transcribe',
        word_timestamps: true
      }
    });

    return {
      text: response.text,
      words: response.words,
      segments: response.segments,
      confidence: response.avg_logprob ? Math.exp(response.avg_logprob) : 0.9
    };
  }

  private enhanceTranscription(result: TranscriptionResult, speakers: Speaker[] | null): string {
    let enhanced = result.text;
    
    // Add speaker labels if available
    if (speakers && speakers.length > 1) {
      enhanced = this.addSpeakerLabels(enhanced, speakers, result.segments);
    }
    
    // Fix common transcription errors
    enhanced = this.correctCommonErrors(enhanced);
    
    // Add intelligent punctuation
    enhanced = this.addIntelligentPunctuation(enhanced);
    
    // Format for readability
    enhanced = this.formatTranscription(enhanced);
    
    return enhanced;
  }

  private correctCommonErrors(text: string): string {
    const corrections = {
      'gonna': 'going to',
      'wanna': 'want to',
      'gotta': 'got to',
      'kinda': 'kind of',
      'sorta': 'sort of',
      ' uh ': ' ',
      ' um ': ' ',
      ' like ': ' '
    };
    
    let corrected = text;
    for (const [error, correction] of Object.entries(corrections)) {
      corrected = corrected.replace(new RegExp(error, 'gi'), correction);
    }
    
    return corrected;
  }

  private calculateTranscriptionConfidence(result: TranscriptionResult): number {
    const factors = [
      result.confidence,
      result.segments?.every(s => s.no_speech_prob < 0.1) ? 0.2 : 0,
      result.text.length > 10 ? 0.1 : 0,
      !result.text.includes('[inaudible]') ? 0.1 : 0
    ];
    
    return Math.min(factors.reduce((a, b) => a + (b || 0), 0), 1.0);
  }

  private assessAudioQuality(audio: ArrayBuffer): AudioQuality {
    // Analyze audio for quality metrics
    const analyzer = new AudioQualityAnalyzer(audio);
    return {
      snr: analyzer.getSignalToNoiseRatio(),
      clarity: analyzer.getSpeechClarity(),
      volume: analyzer.getAverageVolume(),
      clipping: analyzer.detectClipping(),
      quality: analyzer.getOverallQuality()
    };
  }
}

// ============================================
// MODEL 2: WHISPER TINY - FAST FALLBACK
// ============================================

export class WhisperTiny extends BaseModel {
  private streamProcessor: StreamProcessor;
  private chunkBuffer: AudioChunkBuffer;
  
  constructor() {
    super('whisper-tiny', {
      modelName: '@cf/openai/whisper-tiny-en',
      maxAudioLength: 10000, // 10 seconds for speed
      chunkSize: 1000, // 1 second chunks
      streamingEnabled: true,
      latencyTarget: 50, // 50ms target
      accuracyTradeoff: 0.7 // Accept lower accuracy for speed
    });
    
    this.streamProcessor = new StreamProcessor();
    this.chunkBuffer = new AudioChunkBuffer();
  }

  async processInternal(input: ModelInput): Promise<ModelResponse> {
    if (input.stream) {
      return this.processStream(input.audioStream!);
    }
    
    // Ultra-fast processing for small chunks
    const startTime = performance.now();
    
    // Minimal preprocessing for speed
    const audio = this.quickPreprocess(input.audio!);
    
    // Fast transcription with reduced accuracy
    const result = await AI.run(this.config.modelName, {
      audio: Array.from(new Uint8Array(audio)),
      options: {
        temperature: 0.3,
        beam_size: 1, // Minimum for speed
        vad_filter: false, // Skip for speed
        language: 'en'
      }
    });

    const processingTime = performance.now() - startTime;
    
    return {
      text: this.quickClean(result.text),
      confidence: 0.7, // Lower confidence for fast mode
      metadata: {
        processingTime,
        mode: 'fast',
        chunked: false
      },
      modelId: this.modelId,
      timestamp: Date.now()
    };
  }

  private async processStream(stream: ReadableStream): Promise<ModelResponse> {
    const chunks: string[] = [];
    const reader = stream.getReader();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Process each chunk immediately
        const transcribed = await this.processChunk(value);
        chunks.push(transcribed);
        
        // Emit partial results for real-time feedback
        this.emitPartialResult(chunks.join(' '));
      }
    } finally {
      reader.releaseLock();
    }
    
    return {
      text: this.mergeChunks(chunks),
      confidence: 0.75,
      metadata: {
        mode: 'streaming',
        chunkCount: chunks.length
      },
      modelId: this.modelId,
      timestamp: Date.now()
    };
  }

  private quickPreprocess(audio: ArrayBuffer): ArrayBuffer {
    // Minimal processing for speed
    // Just ensure correct format and sample rate
    return this.audioProcessor.quickResample(audio, 16000);
  }

  private quickClean(text: string): string {
    // Basic cleaning only
    return text.trim().replace(/\s+/g, ' ');
  }

  private async processChunk(audioChunk: ArrayBuffer): Promise<string> {
    // Process individual chunk with overlap handling
    this.chunkBuffer.add(audioChunk);
    
    if (this.chunkBuffer.isReady()) {
      const audio = this.chunkBuffer.getWithOverlap();
      const result = await this.transcribeChunk(audio);
      this.chunkBuffer.advance();
      return result;
    }
    
    return '';
  }

  private mergeChunks(chunks: string[]): string {
    // Intelligent chunk merging with overlap removal
    return chunks.reduce((merged, chunk, i) => {
      if (i === 0) return chunk;
      
      // Find and remove overlapping words
      const overlap = this.findOverlap(merged, chunk);
      if (overlap > 0) {
        return merged + ' ' + chunk.split(' ').slice(overlap).join(' ');
      }
      
      return merged + ' ' + chunk;
    }, '');
  }
}

// ============================================
// MODEL 3: QWQ-32B - DEEP REASONING ENGINE
// ============================================

export class QwQReasoning extends BaseModel {
  private reasoningChain: ReasoningChain;
  private knowledgeGraph: KnowledgeGraph;
  private inferenceEngine: InferenceEngine;
  private hypothesisGenerator: HypothesisGenerator;
  
  constructor() {
    super('qwq-32b-preview', {
      modelName: '@cf/qwen/qwq-32b-preview',
      maxTokens: 32768,
      temperature: 0.7,
      reasoningDepth: 5, // Max reasoning steps
      enableCoT: true, // Chain of Thought
      enableToT: true, // Tree of Thoughts
      enableSelfConsistency: true,
      beamSearch: true,
      topK: 40,
      topP: 0.9
    });
    
    this.reasoningChain = new ReasoningChain();
    this.knowledgeGraph = new KnowledgeGraph();
    this.inferenceEngine = new InferenceEngine();
    this.hypothesisGenerator = new HypothesisGenerator();
  }

  async processInternal(input: ModelInput): Promise<ModelResponse> {
    // Extract the problem to solve
    const problem = this.extractProblem(input);
    
    // Build knowledge context
    const knowledge = await this.knowledgeGraph.query(problem);
    
    // Generate multiple reasoning paths in parallel
    const reasoningPaths = await this.generateReasoningPaths(problem, knowledge);
    
    // Evaluate and select best path
    const bestPath = await this.evaluateReasoningPaths(reasoningPaths);
    
    // Generate final response with reasoning
    const response = await this.generateReasonedResponse(bestPath, problem);
    
    return {
      text: response.conclusion,
      confidence: response.confidence,
      metadata: {
        reasoningSteps: response.steps,
        assumptions: response.assumptions,
        alternativePaths: reasoningPaths.length,
        complexity: this.assessComplexity(problem),
        insights: response.insights
      },
      modelId: this.modelId,
      timestamp: Date.now()
    };
  }

  private async generateReasoningPaths(problem: Problem, knowledge: Knowledge): Promise<ReasoningPath[]> {
    const prompts = [
      this.createAnalyticalPrompt(problem, knowledge),
      this.createCreativePrompt(problem, knowledge),
      this.createSystematicPrompt(problem, knowledge),
      this.createFirstPrinciplesPrompt(problem, knowledge)
    ];
    
    const responses = await Promise.all(
      prompts.map(prompt => this.runInference(prompt))
    );
    
    return responses.map(r => this.parseReasoningPath(r));
  }

  private createAnalyticalPrompt(problem: Problem, knowledge: Knowledge): string {
    return `
    <thinking>
    Let me analyze this problem step by step.
    
    Problem: ${problem.statement}
    Context: ${knowledge.context}
    Constraints: ${problem.constraints.join(', ')}
    
    Step 1: Identify key components
    ${this.identifyComponents(problem)}
    
    Step 2: Analyze relationships
    ${this.analyzeRelationships(problem, knowledge)}
    
    Step 3: Apply logical reasoning
    ${this.applyLogic(problem)}
    
    Step 4: Consider edge cases
    ${this.considerEdgeCases(problem)}
    
    Step 5: Synthesize solution
    </thinking>
    
    Based on my analysis, here's my reasoning:
    `;
  }

  private async runInference(prompt: string): Promise<any> {
    const response = await AI.run(this.config.modelName, {
      prompt,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      top_k: this.config.topK,
      top_p: this.config.topP,
      stream: false,
      options: {
        reasoning_mode: true,
        show_work: true,
        confidence_scores: true
      }
    });
    
    return response;
  }

  private async evaluateReasoningPaths(paths: ReasoningPath[]): Promise<ReasoningPath> {
    // Score each path on multiple criteria
    const scores = await Promise.all(paths.map(async path => {
      const logicalScore = this.scoreLogicalConsistency(path);
      const completenessScore = this.scoreCompleteness(path);
      const simplicityScore = this.scoreSimplicity(path);
      const confidenceScore = path.confidence;
      
      return {
        path,
        score: (logicalScore * 0.4 + completenessScore * 0.3 + 
                simplicityScore * 0.2 + confidenceScore * 0.1)
      };
    }));
    
    // Return path with highest score
    return scores.sort((a, b) => b.score - a.score)[0].path;
  }

  private scoreLogicalConsistency(path: ReasoningPath): number {
    // Check for contradictions, circular reasoning, etc.
    let score = 1.0;
    
    // Check for contradictions
    const hasContradictions = this.detectContradictions(path.steps);
    if (hasContradictions) score -= 0.3;
    
    // Check for logical fallacies
    const fallacies = this.detectFallacies(path.steps);
    score -= fallacies.length * 0.1;
    
    // Check causal chain validity
    const causalValid = this.validateCausalChain(path.steps);
    if (!causalValid) score -= 0.2;
    
    return Math.max(0, score);
  }

  private assessComplexity(problem: Problem): ComplexityAssessment {
    return {
      cognitive: this.assessCognitiveComplexity(problem),
      computational: this.assessComputationalComplexity(problem),
      domain: this.assessDomainComplexity(problem),
      overall: this.calculateOverallComplexity(problem)
    };
  }
}

// ============================================
// MODEL 4: LLAMA-70B - PROFESSIONAL SALES
// ============================================

export class Llama70B extends BaseModel {
  private salesIntelligence: SalesIntelligence;
  private toneAnalyzer: ToneAnalyzer;
  private persuasionEngine: PersuasionEngine;
  private industryKnowledge: IndustryKnowledge;
  
  constructor() {
    super('llama-70b', {
      modelName: '@cf/meta/llama-3.1-70b-instruct',
      maxTokens: 8192,
      temperature: 0.8,
      systemPrompt: 'You are an elite enterprise sales expert with deep industry knowledge.',
      responseStyle: 'professional',
      enableRAG: true,
      industrySpecialization: true
    });
    
    this.salesIntelligence = new SalesIntelligence();
    this.toneAnalyzer = new ToneAnalyzer();
    this.persuasionEngine = new PersuasionEngine();
    this.industryKnowledge = new IndustryKnowledge();
  }

  async processInternal(input: ModelInput): Promise<ModelResponse> {
    // Analyze conversation context
    const context = await this.analyzeContext(input);
    
    // Identify sales stage and strategy
    const salesStage = this.salesIntelligence.identifyStage(context);
    const strategy = this.salesIntelligence.selectStrategy(salesStage, context);
    
    // Load relevant industry knowledge
    const industryContext = await this.industryKnowledge.load(context.industry);
    
    // Craft professional response
    const response = await this.craftProfessionalResponse(
      input,
      context,
      strategy,
      industryContext
    );
    
    return {
      text: response.text,
      confidence: response.confidence,
      metadata: {
        salesStage: salesStage.name,
        strategy: strategy.type,
        persuasionTechniques: response.techniques,
        industryInsights: response.insights,
        nextSteps: response.nextSteps,
        objectionHandling: response.objections
      },
      modelId: this.modelId,
      timestamp: Date.now()
    };
  }

  private async craftProfessionalResponse(
    input: ModelInput,
    context: ConversationContext,
    strategy: SalesStrategy,
    industry: IndustryContext
  ): Promise<ProfessionalResponse> {
    
    const prompt = this.buildProfessionalPrompt(input, context, strategy, industry);
    
    const response = await AI.run(this.config.modelName, {
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt(context, industry)
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });

    return this.enhanceProfessionalResponse(response, strategy);
  }

  private getSystemPrompt(context: ConversationContext, industry: IndustryContext): string {
    return `You are a senior enterprise sales executive with 15+ years of experience in ${industry.name}.
    
    Your expertise includes:
    - ${industry.keyTechnologies.join(', ')}
    - Understanding of ${industry.mainChallenges.join(', ')}
    - Deep knowledge of ${industry.competitors.join(', ')}
    
    Communication style:
    - Professional and consultative
    - Data-driven and ROI-focused
    - Empathetic and solution-oriented
    - Strategic and forward-thinking
    
    Current context:
    - Company: ${context.company}
    - Deal size: ${context.dealSize}
    - Decision makers: ${context.stakeholders.join(', ')}
    - Timeline: ${context.timeline}
    `;
  }

  private buildProfessionalPrompt(
    input: ModelInput,
    context: ConversationContext,
    strategy: SalesStrategy,
    industry: IndustryContext
  ): string {
    return `
    Customer statement: "${input.text}"
    
    Sales objective: ${strategy.objective}
    Recommended approach: ${strategy.approach}
    
    Key points to address:
    ${strategy.keyPoints.map(p => `- ${p}`).join('\n')}
    
    Industry-specific value props:
    ${industry.valueProps.map(v => `- ${v}`).join('\n')}
    
    Craft a response that:
    1. Acknowledges their specific concern/question
    2. Provides concrete value using ${industry.name} examples
    3. Builds trust through expertise demonstration
    4. Moves the conversation toward ${strategy.nextStep}
    5. Includes specific metrics/data points when relevant
    `;
  }

  private enhanceProfessionalResponse(
    response: any,
    strategy: SalesStrategy
  ): ProfessionalResponse {
    let enhanced = response.text;
    
    // Add power words for impact
    enhanced = this.addPowerWords(enhanced, strategy);
    
    // Include social proof when appropriate
    if (strategy.includeSocialProof) {
      enhanced = this.addSocialProof(enhanced);
    }
    
    // Add urgency without being pushy
    if (strategy.createUrgency) {
      enhanced = this.addSubtleUrgency(enhanced);
    }
    
    return {
      text: enhanced,
      confidence: this.calculateSalesConfidence(response, strategy),
      techniques: this.identifyUsedTechniques(enhanced),
      insights: this.extractInsights(enhanced),
      nextSteps: this.identifyNextSteps(enhanced),
      objections: this.anticipateObjections(enhanced, strategy)
    };
  }

  private addPowerWords(text: string, strategy: SalesStrategy): string {
    const powerWords = {
      value: ['transform', 'accelerate', 'optimize', 'streamline'],
      trust: ['proven', 'trusted', 'established', 'recognized'],
      innovation: ['cutting-edge', 'advanced', 'next-generation', 'pioneering'],
      results: ['measurable', 'significant', 'substantial', 'dramatic']
    };
    
    // Intelligently insert power words based on strategy
    return this.intelligentlyEnhanceText(text, powerWords[strategy.focus]);
  }
}

// ============================================
// MODEL 5: LLAMA-8B - CASUAL/STARTUP TONE
// ============================================

export class Llama8B extends BaseModel {
  private startupLingo: StartupLingo;
  private casualToneGenerator: CasualToneGenerator;
  private emojiOptimizer: EmojiOptimizer;
  
  constructor() {
    super('llama-8b', {
      modelName: '@cf/meta/llama-3.2-8b-instruct',
      maxTokens: 4096,
      temperature: 0.9,
      systemPrompt: 'You are a friendly, approachable startup founder who gets things done.',
      responseStyle: 'casual',
      enableEmoji: true,
      enableSlang: true
    });
    
    this.startupLingo = new StartupLingo();
    this.casualToneGenerator = new CasualToneGenerator();
    this.emojiOptimizer = new EmojiOptimizer();
  }

  async processInternal(input: ModelInput): Promise<ModelResponse> {
    const context = this.analyzeStartupContext(input);
    
    const prompt = this.buildCasualPrompt(input, context);
    
    const response = await AI.run(this.config.modelName, {
      messages: [
        {
          role: 'system',
          content: this.getCasualSystemPrompt(context)
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature
    });

    return {
      text: this.casualizeResponse(response.text, context),
      confidence: response.confidence || 0.85,
      metadata: {
        tone: 'casual',
        emojiCount: this.countEmojis(response.text),
        readingLevel: 'conversational',
        enthusiasm: this.measureEnthusiasm(response.text)
      },
      modelId: this.modelId,
      timestamp: Date.now()
    };
  }

  private getCasualSystemPrompt(context: any): string {
    return `You're a startup founder who's been in the trenches. You speak casually but knowledgeably.

    Your style:
    - Use "we" instead of "I" - team player
    - Short, punchy sentences
    - Relatable analogies and examples
    - Genuine enthusiasm without corporate speak
    - Occasional emoji when it fits naturally 🚀
    - Reference startup culture (YC, Product Hunt, etc.)
    
    Never:
    - Use corporate jargon unnecessarily
    - Sound like a sales robot
    - Be overly formal
    - Lose authenticity
    `;
  }

  private casualizeResponse(text: string, context: any): string {
    // Make it more casual and startup-friendly
    let casual = text;
    
    // Replace formal phrases
    casual = this.replaceFormalPhrases(casual);
    
    // Add natural contractions
    casual = this.addContractions(casual);
    
    // Insert strategic emojis
    if (this.config.enableEmoji) {
      casual = this.emojiOptimizer.optimize(casual, context);
    }
    
    // Add startup references when relevant
    casual = this.addStartupContext(casual, context);
    
    return casual;
  }

  private replaceFormalPhrases(text: string): string {
    const replacements = {
      'utilize': 'use',
      'implement': 'build',
      'facilitate': 'help with',
      'leverage': 'use',
      'synergize': 'work together',
      'regarding': 'about',
      'therefore': 'so',
      'however': 'but',
      'commence': 'start',
      'terminate': 'end'
    };
    
    let casual = text;
    for (const [formal, casual_replacement] of Object.entries(replacements)) {
      casual = casual.replace(new RegExp(`\\b${formal}\\b`, 'gi'), casual_replacement);
    }
    
    return casual;
  }

  private addContractions(text: string): string {
    const contractions = {
      'we are': "we're",
      'you are': "you're",
      'it is': "it's",
      'that is': "that's",
      'would not': "wouldn't",
      'could not': "couldn't",
      'should not': "shouldn't",
      'will not': "won't",
      'do not': "don't"
    };
    
    let contracted = text;
    for (const [full, contraction] of Object.entries(contractions)) {
      contracted = contracted.replace(new RegExp(full, 'gi'), contraction);
    }
    
    return contracted;
  }
}