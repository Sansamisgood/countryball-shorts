// ===== Enums =====
export enum Step {
  TOPIC_DISCOVERY = 0,
  PLANNING_CASTING = 1,
  SCRIPT_WRITING = 2,
  STORYBOARD = 3,
  SEO = 4,
}

// ===== YouTube SEO =====
export interface YouTubeSEO {
  titles: string[];
  description: string;
  tags: string[];
  thumbnailTexts: string[];
  hashtags: string[];
  hookLine: string;
  category: string;
}

export type EmotionType = 'HAPPY' | 'ANGRY' | 'SAD' | 'SURPRISED' | 'NEUTRAL';
export type AnimationStyle = 'STOP_MOTION' | 'GEN_SWAP' | 'BOUNCE';
export type CompositionType = 'SOLO' | 'TWO_SHOT' | 'ONE_VS_MANY' | 'TEAM';
export type SceneType = 'DIALOGUE' | 'NARRATION' | 'REACTION' | 'MONTAGE' | 'TITLE' | 'ENDING';

// ===== Mouth / SVG Rendering =====
export interface MouthLayer {
  d: string;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface MouthFrame {
  layers: MouthLayer[];
}

// Sketchy mouth frames for STOP_MOTION style
export const SKETCHY_MOUTH_FRAMES: Record<EmotionType, MouthFrame[]> = {
  HAPPY: [
    { layers: [{ d: 'M 35 55 Q 50 70 65 55', fill: 'none', stroke: '#1a1a1a', strokeWidth: 2.5 }] },
    { layers: [{ d: 'M 33 54 Q 50 72 67 54', fill: '#8B0000', stroke: '#1a1a1a', strokeWidth: 2.5 }, { d: 'M 38 54 Q 50 62 62 54', fill: '#FF6B6B', stroke: 'none' }] },
    { layers: [{ d: 'M 32 53 Q 50 75 68 53', fill: '#8B0000', stroke: '#1a1a1a', strokeWidth: 2.5 }, { d: 'M 37 53 Q 50 63 63 53', fill: '#FF6B6B', stroke: 'none' }] },
  ],
  ANGRY: [
    { layers: [{ d: 'M 35 60 L 50 55 L 65 60', fill: 'none', stroke: '#1a1a1a', strokeWidth: 2.5 }] },
    { layers: [{ d: 'M 33 62 Q 50 52 67 62', fill: '#8B0000', stroke: '#1a1a1a', strokeWidth: 2.5 }] },
    { layers: [{ d: 'M 35 63 Q 50 50 65 63', fill: '#8B0000', stroke: '#1a1a1a', strokeWidth: 2.5 }, { d: 'M 40 58 L 42 52 L 48 55 L 52 55 L 58 52 L 60 58', fill: 'white', stroke: 'none' }] },
  ],
  SAD: [
    { layers: [{ d: 'M 35 62 Q 50 52 65 62', fill: 'none', stroke: '#1a1a1a', strokeWidth: 2.5 }] },
    { layers: [{ d: 'M 33 63 Q 50 50 67 63', fill: '#8B0000', stroke: '#1a1a1a', strokeWidth: 2.5 }] },
    { layers: [{ d: 'M 36 60 Q 50 55 64 60', fill: 'none', stroke: '#1a1a1a', strokeWidth: 2.5 }] },
  ],
  SURPRISED: [
    { layers: [{ d: 'M 42 52 A 8 10 0 1 1 58 52 A 8 10 0 1 1 42 52', fill: '#8B0000', stroke: '#1a1a1a', strokeWidth: 2.5 }] },
    { layers: [{ d: 'M 40 52 A 10 12 0 1 1 60 52 A 10 12 0 1 1 40 52', fill: '#8B0000', stroke: '#1a1a1a', strokeWidth: 2.5 }] },
    { layers: [{ d: 'M 41 52 A 9 11 0 1 1 59 52 A 9 11 0 1 1 41 52', fill: '#8B0000', stroke: '#1a1a1a', strokeWidth: 2.5 }] },
  ],
  NEUTRAL: [
    { layers: [{ d: 'M 38 57 L 62 57', fill: 'none', stroke: '#1a1a1a', strokeWidth: 2.5 }] },
    { layers: [{ d: 'M 38 57 Q 50 60 62 57', fill: 'none', stroke: '#1a1a1a', strokeWidth: 2.5 }] },
    { layers: [{ d: 'M 38 57 L 62 57', fill: 'none', stroke: '#1a1a1a', strokeWidth: 2.5 }] },
  ],
};

// Clean vector mouth frames for GEN_SWAP style
export const CLEAN_MOUTH_FRAMES: Record<EmotionType, MouthFrame[]> = {
  HAPPY: [
    { layers: [{ d: 'M 36 55 Q 50 68 64 55 Z', fill: '#CC0000', stroke: '#333', strokeWidth: 1.5 }, { d: 'M 40 55 Q 50 62 60 55', fill: '#FF9999', stroke: 'none' }] },
    { layers: [{ d: 'M 34 54 Q 50 72 66 54 Z', fill: '#CC0000', stroke: '#333', strokeWidth: 1.5 }, { d: 'M 39 54 Q 50 64 61 54', fill: '#FF9999', stroke: 'none' }] },
    { layers: [{ d: 'M 35 55 Q 50 70 65 55 Z', fill: '#CC0000', stroke: '#333', strokeWidth: 1.5 }, { d: 'M 40 55 Q 50 63 60 55', fill: '#FF9999', stroke: 'none' }] },
  ],
  ANGRY: [
    { layers: [{ d: 'M 36 60 Q 50 52 64 60 Z', fill: '#990000', stroke: '#333', strokeWidth: 1.5 }] },
    { layers: [{ d: 'M 34 62 Q 50 50 66 62 Z', fill: '#990000', stroke: '#333', strokeWidth: 1.5 }, { d: 'M 42 56 L 44 52 L 50 55 L 56 52 L 58 56', fill: 'white', stroke: 'none' }] },
    { layers: [{ d: 'M 35 61 Q 50 51 65 61 Z', fill: '#990000', stroke: '#333', strokeWidth: 1.5 }] },
  ],
  SAD: [
    { layers: [{ d: 'M 36 62 Q 50 54 64 62 Z', fill: '#993333', stroke: '#333', strokeWidth: 1.5 }] },
    { layers: [{ d: 'M 34 63 Q 50 52 66 63 Z', fill: '#993333', stroke: '#333', strokeWidth: 1.5 }] },
    { layers: [{ d: 'M 35 62 Q 50 53 65 62 Z', fill: '#993333', stroke: '#333', strokeWidth: 1.5 }] },
  ],
  SURPRISED: [
    { layers: [{ d: 'M 43 50 A 7 9 0 1 1 57 50 A 7 9 0 1 1 43 50 Z', fill: '#CC0000', stroke: '#333', strokeWidth: 1.5 }] },
    { layers: [{ d: 'M 41 50 A 9 11 0 1 1 59 50 A 9 11 0 1 1 41 50 Z', fill: '#CC0000', stroke: '#333', strokeWidth: 1.5 }] },
    { layers: [{ d: 'M 42 50 A 8 10 0 1 1 58 50 A 8 10 0 1 1 42 50 Z', fill: '#CC0000', stroke: '#333', strokeWidth: 1.5 }] },
  ],
  NEUTRAL: [
    { layers: [{ d: 'M 39 57 L 61 57', fill: 'none', stroke: '#333', strokeWidth: 2 }] },
    { layers: [{ d: 'M 39 57 Q 50 59 61 57', fill: 'none', stroke: '#333', strokeWidth: 2 }] },
    { layers: [{ d: 'M 39 57 L 61 57', fill: 'none', stroke: '#333', strokeWidth: 2 }] },
  ],
};

// ===== Country Data =====
export interface CountryFlag {
  code: string;
  name: string;
  nameKo: string;
}

export const COUNTRY_FLAGS: CountryFlag[] = [
  { code: 'KR', name: 'South Korea', nameKo: '한국' },
  { code: 'US', name: 'United States', nameKo: '미국' },
  { code: 'JP', name: 'Japan', nameKo: '일본' },
  { code: 'CN', name: 'China', nameKo: '중국' },
  { code: 'RU', name: 'Russia', nameKo: '러시아' },
  { code: 'GB', name: 'United Kingdom', nameKo: '영국' },
  { code: 'FR', name: 'France', nameKo: '프랑스' },
  { code: 'DE', name: 'Germany', nameKo: '독일' },
  { code: 'IT', name: 'Italy', nameKo: '이탈리아' },
  { code: 'CA', name: 'Canada', nameKo: '캐나다' },
  { code: 'AU', name: 'Australia', nameKo: '호주' },
  { code: 'BR', name: 'Brazil', nameKo: '브라질' },
  { code: 'IN', name: 'India', nameKo: '인도' },
  { code: 'MX', name: 'Mexico', nameKo: '멕시코' },
  { code: 'ES', name: 'Spain', nameKo: '스페인' },
  { code: 'SE', name: 'Sweden', nameKo: '스웨덴' },
  { code: 'NO', name: 'Norway', nameKo: '노르웨이' },
  { code: 'KP', name: 'North Korea', nameKo: '북한' },
  { code: 'SA', name: 'Saudi Arabia', nameKo: '사우디아라비아' },
  { code: 'TR', name: 'Turkey', nameKo: '터키' },
];

// ===== Topic & News =====
export interface TopicCandidate {
  title: string;
  oneLiner: string;
  keyFacts: string[];
  countriesInvolved: string[];
  koreaAngle: string;
  humorPotential: string;
  sourceHint: string;
}

// ===== Script & Scene =====
export interface DialogueLine {
  speaker: string;       // country code (e.g., 'KR')
  text: string;
  emotion: EmotionType;
  animation: AnimationStyle;
}

export interface ScriptScene {
  sceneNumber: number;
  sceneType: SceneType;
  composition: CompositionType;
  setting: string;
  dialogue: DialogueLine[];
  directorNote: string;
  durationSec: number;
}

// ===== Character =====
export interface CharacterProfile {
  countryCode: string;
  role: string;
  personality: string;
  masterPrompt: string;
  baseImageUrl?: string;
}

export type CastPosition = 'LEFT' | 'RIGHT' | 'CENTER' | 'BACKGROUND';

export interface CastMember {
  countryCode: string;
  role: string;
  personality: string;
  visualCue?: string;
  position?: CastPosition;
}

// ===== Episode Plan =====
export interface EpisodePlan {
  title: string;
  synopsis: string;
  cast: CastMember[];
  actStructure: string[];
  comedyBeats: string[];
  koreaWinMoment: string;
}

// ===== Insert Asset =====
export interface InsertAsset {
  sceneNumber: number;
  type: 'background' | 'prop' | 'effect';
  description: string;
  imageUrl?: string;
}

// ===== Workflow State =====
export interface WorkflowState {
  currentStep: Step;
  // Step 0: Topic Discovery
  topicCandidates: TopicCandidate[];
  selectedTopic: TopicCandidate | null;
  // Step 1: Planning & Casting
  episodePlan: EpisodePlan | null;
  characterProfiles: CharacterProfile[];
  // Step 2: Script Writing
  draftScript: ScriptScene[];
  editedScript: string;
  finalScript: ScriptScene[];
  // Step 3: Storyboard
  storyboardImages: Map<number, string>;
  insertAssets: InsertAsset[];
  // Meta
  isLoading: boolean;
  loadingMessage: string;
  error: string | null;
}

// ===== Project Data (for export) =====
export interface ProjectData {
  version: string;
  createdAt: string;
  topic: TopicCandidate | null;
  plan: EpisodePlan | null;
  characters: CharacterProfile[];
  script: ScriptScene[];
  storyboard: Record<number, string>;
  assets: InsertAsset[];
}

// ===== Used Topics (localStorage persistence) =====
export interface UsedTopic {
  title: string;
  usedAt: string;
}

// ===== Mouth Props (for SVG component) =====
export interface MouthProps {
  emotion: EmotionType;
  style: AnimationStyle;
  isTalking: boolean;
  size?: number;
}

// ===== News Item (for API) =====
export interface NewsItem {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  summary: string;
}

// ===== Initial State =====
export const INITIAL_STATE: WorkflowState = {
  currentStep: Step.TOPIC_DISCOVERY,
  topicCandidates: [],
  selectedTopic: null,
  episodePlan: null,
  characterProfiles: [],
  draftScript: [],
  editedScript: '',
  finalScript: [],
  storyboardImages: new Map(),
  insertAssets: [],
  isLoading: false,
  loadingMessage: '',
  error: null,
};

// ===== Loading Messages =====
export const LOADING_MESSAGES = [
  '뉴스를 뒤지는 중... 📰',
  '국뽕 소재를 탐색 중... 🇰🇷',
  '컨트리볼들을 소환하는 중... 🌍',
  'AI가 시나리오를 쓰는 중... ✍️',
  '웃음 포인트를 계산하는 중... 😂',
  '한국의 위대함을 발굴하는 중... 💪',
  '외국 반응을 시뮬레이션 중... 👀',
  '대본을 다듬는 중... 📝',
  '스토리보드를 그리는 중... 🎨',
  '캐릭터에 생명을 불어넣는 중... ✨',
];
