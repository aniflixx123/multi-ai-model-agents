// src/services/realtime/AudioStreamer.ts

export class AudioStreamer {
  private buffer: ArrayBuffer[] = [];
  private isStreaming: boolean = false;
  
  async startStream(): Promise<void> {
    this.isStreaming = true;
    this.buffer = [];
  }
  
  async stopStream(): Promise<void> {
    this.isStreaming = false;
  }
  
  async addChunk(chunk: ArrayBuffer): Promise<void> {
    if (this.isStreaming) {
      this.buffer.push(chunk);
    }
  }
  
  getBuffer(): ArrayBuffer[] {
    return this.buffer;
  }
  
  clear(): void {
    this.buffer = [];
  }
}

export class StreamProcessor {
  private buffer: ArrayBuffer[] = [];
  
  async process(stream: ReadableStream): Promise<any> {
    const reader = stream.getReader();
    const chunks: ArrayBuffer[] = [];
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    
    return {
      text: '',
      chunks: chunks.length
    };
  }
  
  reset(): void {
    this.buffer = [];
  }
}

export class AudioChunkBuffer {
  private chunks: ArrayBuffer[] = [];
  private overlapSize: number = 512; // samples to overlap
  private chunkSize: number = 16000; // 1 second at 16kHz
  
  add(chunk: ArrayBuffer): void {
    this.chunks.push(chunk);
  }
  
  isReady(): boolean {
    // Check if we have enough data to process
    const totalSize = this.chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    return totalSize >= this.chunkSize;
  }
  
  getWithOverlap(): ArrayBuffer {
    if (this.chunks.length === 0) {
      return new ArrayBuffer(0);
    }
    
    // Combine chunks with overlap
    const totalSize = this.chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const combined = new Uint8Array(totalSize);
    
    let offset = 0;
    for (const chunk of this.chunks) {
      const chunkArray = new Uint8Array(chunk);
      combined.set(chunkArray, offset);
      offset += chunkArray.length;
    }
    
    return combined.buffer;
  }
  
  advance(): void {
    // Move to next chunk, keeping some overlap
    if (this.chunks.length > 0) {
      // Keep last part of current chunk for overlap
      const lastChunk = this.chunks[this.chunks.length - 1];
      const overlapData = this.extractOverlap(lastChunk);
      
      // Clear chunks and add overlap
      this.chunks = overlapData ? [overlapData] : [];
    }
  }
  
  private extractOverlap(chunk: ArrayBuffer): ArrayBuffer | null {
    if (chunk.byteLength < this.overlapSize) {
      return chunk;
    }
    
    const array = new Uint8Array(chunk);
    const overlapArray = array.slice(-this.overlapSize);
    return overlapArray.buffer;
  }
  
  clear(): void {
    this.chunks = [];
  }
  
  getTotalSize(): number {
    return this.chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  }
}