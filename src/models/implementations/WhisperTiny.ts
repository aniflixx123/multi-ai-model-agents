// src/models/implementations/WhisperTiny.ts

import { BaseModel } from '../base/BaseModel';
import { ModelInput, ModelResponse } from '../../types/models';
import { StreamProcessor, AudioChunkBuffer } from '../../services/realtime/AudioStreamer';
import { AdvancedAudioProcessor } from '../../utils/audio/AudioProcessor';
import { AI } from '../../services/cloudflare/CloudflareAI';

export class WhisperTiny extends BaseModel {
  private streamProcessor: StreamProcessor;
  private chunkBuffer: AudioChunkBuffer;
  private audioProcessor: AdvancedAudioProcessor;
  
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
    this.audioProcessor = new AdvancedAudioProcessor();
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

  private async transcribeChunk(audio: ArrayBuffer): Promise<string> {
    // Transcribe a single audio chunk
    try {
      const result = await AI.run(this.config.modelName, {
        audio: Array.from(new Uint8Array(audio)),
        options: {
          temperature: 0.3,
          beam_size: 1,
          vad_filter: false,
          language: 'en'
        }
      });
      
      return result.text || '';
    } catch (error) {
      console.error('Chunk transcription error:', error);
      return '';
    }
  }

  private emitPartialResult(text: string): void {
    // Emit partial transcription results for real-time feedback
    // In a real implementation, this would send data through WebSocket or EventStream
    if (typeof self !== 'undefined' && 'postMessage' in self) {
      self.postMessage({
        type: 'partial_transcription',
        text,
        timestamp: Date.now()
      });
    }
  }

  private findOverlap(text1: string, text2: string): number {
    // Find overlapping words between two text segments
    const words1 = text1.split(' ');
    const words2 = text2.split(' ');
    
    // Check for overlap at the end of text1 and beginning of text2
    let maxOverlap = Math.min(words1.length, words2.length, 5); // Check up to 5 words
    
    for (let overlap = maxOverlap; overlap > 0; overlap--) {
      const end1 = words1.slice(-overlap).join(' ');
      const start2 = words2.slice(0, overlap).join(' ');
      
      if (end1.toLowerCase() === start2.toLowerCase()) {
        return overlap;
      }
    }
    
    return 0;
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