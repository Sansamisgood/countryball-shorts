/**
 * voiceMappings.ts
 * 브라우저에서 안전하게 사용 가능한 음성 매핑/레이블 함수.
 * Node.js API(Buffer 등)를 사용하지 않으므로 클라이언트 번들에 포함 가능.
 */

// ===== Gemini Voice Labels =====

const COUNTRY_GEMINI_VOICE_LABELS: Record<string, string> = {
  KR: '한국 (중후한 남성)',
  US: '미국 (강인한)',
  JP: '일본 (차분한)',
  CN: '중국 (낮은 톤)',
  RU: '러시아 (무게감 저음)',
  FR: '프랑스 (부드러운)',
  DE: '독일 (안정적)',
  GB: '영국 (성숙한)',
  IT: '이탈리아 (지적)',
  ES: '스페인 (중후한)',
  CA: '캐나다 (부드러운)',
  AU: '호주 (편안한)',
  BR: '브라질 (활기찬)',
  IN: '인도 (정보 전달형)',
  MX: '멕시코 (활발한)',
  SE: '스웨덴 (지적)',
  NO: '노르웨이 (맑은)',
  SA: '사우디 (저음 지적)',
  TR: '터키 (힘 있는)',
  KP: '북한 (낮고 단단한)',
};

export function getGeminiVoiceLabelForCountry(countryCode: string): string {
  return COUNTRY_GEMINI_VOICE_LABELS[countryCode.toUpperCase()] ?? '기본 남성';
}

// ===== Supertone Voice Labels =====

const SUPERTONE_VOICE_LABELS: Record<string, string> = {
  Adam: '부드러운 남성',
  James: '중후한 남성',
  Haneul: '차분한 남성',
  Bella: '젊은 여성',
  Sumin: '성인 여성',
  Ara: '클래식 여성',
  Bora: '밝은 여성',
  Dami: '부드러운 여성',
};

const COUNTRY_SUPERTONE_MAP: Record<string, string> = {
  KR: 'Adam', US: 'James', JP: 'Haneul', CN: 'James', RU: 'James',
  GB: 'James', FR: 'Haneul', DE: 'James', IT: 'Adam', ES: 'Adam',
  CA: 'Adam', AU: 'James', BR: 'Adam', IN: 'Haneul', MX: 'Adam',
  SE: 'Haneul', NO: 'Haneul', SA: 'James', TR: 'Adam', KP: 'Haneul',
  DEFAULT: 'Adam',
};

export function getSupertoneVoiceLabelForCountry(countryCode: string): string {
  const voiceId = COUNTRY_SUPERTONE_MAP[countryCode.toUpperCase()] ?? COUNTRY_SUPERTONE_MAP.DEFAULT;
  return SUPERTONE_VOICE_LABELS[voiceId] ?? '기본 남성';
}
