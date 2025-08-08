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