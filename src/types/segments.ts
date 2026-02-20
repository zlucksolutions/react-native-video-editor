// Segment type definitions
export type SegmentType = 'audio' | 'text' | 'voiceover' | 'trim';

export interface BaseSegment {
  id: string;
  type: SegmentType;
  start: number; // in seconds
  end: number; // in seconds
}

export interface AudioSegment extends BaseSegment {
  type: 'audio';
  uri: string;
  name: string;
  color: string;
  audioOffset: number; // start time within the audio file
  clipDuration: number; // duration of the audio clip
  isLooped: boolean;
}

export interface TextSegment extends BaseSegment {
  type: 'text';
  text: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
  fontFamily?: string;
  x?: number; // position on screen
  y?: number;
  alignment?: 'left' | 'center' | 'right';
}

export interface VoiceoverSegment extends BaseSegment {
  type: 'voiceover';
  uri: string;
  name: string;
  color: string;
}

export interface TrimSegment {
  type: 'trim';
}

export type Segment = AudioSegment | TextSegment | VoiceoverSegment;

export interface ActiveSegmentInfo {
  type: SegmentType;
  id?: string;
}
