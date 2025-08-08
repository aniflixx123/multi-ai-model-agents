// src/models/implementations/WhisperLarge.ts

import { BaseModel } from '../base/BaseModel';
import { 
  ModelInput, 
  ModelResponse, 
  TranscriptionResult, 
  Speaker, 
  AudioQuality,
  Segment
} from '../../types/models';
import { 
  AdvancedAudioProcessor, 
  NoiseReductionEngine, 
  AudioQualityAnalyzer 
} from '../../utils/audio/AudioProcessor';
import { 
  LanguageDetector, 
  SpeakerDiarization 
} from '../../utils/audio/AudioAnalyzer';
import { AI } from '../../services/cloudflare/CloudflareAI';

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
      text: response.text || '',
      words: response.words || [],
      segments: response.segments || [],
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

  private addSpeakerLabels(text: string, speakers: Speaker[], segments?: Segment[]): string {
    // Add speaker labels to transcription
    if (!segments || segments.length === 0) {
      return text;
    }
    
    let labeledText = '';
    let currentSpeaker = '';
    
    for (const segment of segments) {
      // Find which speaker this segment belongs to
      const speaker = this.findSpeakerForSegment(segment, speakers);
      
      if (speaker && speaker.id !== currentSpeaker) {
        labeledText += `\n[${speaker.id}]: `;
        currentSpeaker = speaker.id;
      }
      
      labeledText += segment.text + ' ';
    }
    
    return labeledText.trim();
  }

  private findSpeakerForSegment(segment: Segment, speakers: Speaker[]): Speaker | null {
    // Find which speaker owns this time segment
    for (const speaker of speakers) {
      for (const speakerSegment of speaker.segments) {
        if (this.segmentsOverlap(segment, speakerSegment)) {
          return speaker;
        }
      }
    }
    return null;
  }

  private segmentsOverlap(seg1: Segment, seg2: Segment): boolean {
    // Check if two segments overlap in time
    return seg1.start < seg2.end && seg2.start < seg1.end;
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

  private addIntelligentPunctuation(text: string): string {
    // Add punctuation based on sentence patterns
    let punctuated = text;
    
    // Add periods at natural sentence boundaries
    punctuated = punctuated.replace(/([a-z])(\s+[A-Z])/g, '$1.$2');
    
    // Add question marks for questions
    const questionWords = ['what', 'when', 'where', 'who', 'why', 'how', 'is', 'are', 'can', 'could', 'would', 'should'];
    for (const word of questionWords) {
      const regex = new RegExp(`(^|\\. )${word} [^.!?]+`, 'gi');
      punctuated = punctuated.replace(regex, (match) => {
        if (!match.endsWith('.') && !match.endsWith('?') && !match.endsWith('!')) {
          return match + '?';
        }
        return match;
      });
    }
    
    // Ensure sentence ends with punctuation
    if (!/[.!?]$/.test(punctuated)) {
      punctuated += '.';
    }
    
    return punctuated;
  }

  private formatTranscription(text: string): string {
    // Format for readability
    let formatted = text;
    
    // Capitalize first letter of sentences
    formatted = formatted.replace(/(^|\. )([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());
    
    // Fix spacing around punctuation
    formatted = formatted.replace(/\s+([.!?,])/g, '$1');
    formatted = formatted.replace(/([.!?])\s*/g, '$1 ');
    
    // Remove extra spaces
    formatted = formatted.replace(/\s+/g, ' ').trim();
    
    // Break into paragraphs for long text
    if (formatted.length > 500) {
      const sentences = formatted.split('. ');
      const paragraphs = [];
      let currentParagraph = [];
      
      for (const sentence of sentences) {
        currentParagraph.push(sentence);
        if (currentParagraph.length >= 3) {
          paragraphs.push(currentParagraph.join('. ') + '.');
          currentParagraph = [];
        }
      }
      
      if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.join('. ') + '.');
      }
      
      formatted = paragraphs.join('\n\n');
    }
    
    return formatted;
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