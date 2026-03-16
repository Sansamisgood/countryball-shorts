// ===== Gemini API 유틸리티 =====
// 재시도, Rate Limit 보호, JSON 복구 기능

// ─── Rate Limit 상태 (모듈 수준 싱글턴) ───────────────────────────────
const MIN_API_INTERVAL_MS = 1500; // 최소 1.5초 간격
let lastApiCallTime = 0;
let consecutiveQuotaErrors = 0;

// 병렬 호출 시 race condition 방지용 직렬화 체인
let rateLimitChain = Promise.resolve();

/** 연속 Quota 에러 수를 1 증가시킵니다. */
export const trackApiQuotaError = (): void => {
  consecutiveQuotaErrors = Math.min(5, consecutiveQuotaErrors + 1);
  console.warn(
    `[RateLimit] Quota 에러 누적: ${consecutiveQuotaErrors}회, ` +
    `다음 요청 ${MIN_API_INTERVAL_MS + consecutiveQuotaErrors * 5000}ms 후`
  );
};

/** 성공 시 연속 Quota 에러 수를 1 감소시킵니다. */
export const trackApiSuccess = (): void => {
  consecutiveQuotaErrors = Math.max(0, consecutiveQuotaErrors - 1);
};

/**
 * 순차 API 호출 사이에 적응형 딜레이를 삽입합니다.
 * Promise 체인으로 직렬화되어 병렬 Promise.all에서도 순차적으로 대기합니다.
 */
export const rateLimitedDelay = (): Promise<void> => {
  const ticket = rateLimitChain.then(async () => {
    const now = Date.now();
    const elapsed = now - lastApiCallTime;
    const adaptiveInterval = MIN_API_INTERVAL_MS + consecutiveQuotaErrors * 3000;
    if (elapsed < adaptiveInterval) {
      await new Promise<void>((r) => setTimeout(r, adaptiveInterval - elapsed));
    }
    lastApiCallTime = Date.now();
  });
  rateLimitChain = ticket.catch(() => {});
  return ticket;
};

/**
 * 일시적 오류(429, 503, 네트워크 오류 등)에 대해 지수 백오프로 재시도합니다.
 *
 * @param fn - 실행할 비동기 함수
 * @param maxRetries - 최대 재시도 횟수 (기본 5)
 * @param baseDelay - 기본 대기 시간(ms) (기본 3000)
 */
export const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  baseDelay = 3000
): Promise<T> => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const msg = (
        error instanceof Error ? error.message : String(error)
      ).toLowerCase();

      const is429 =
        msg.includes("429") ||
        msg.includes("too many requests") ||
        msg.includes("quota") ||
        msg.includes("resource_exhausted");

      const isRetryable =
        is429 ||
        msg.includes("503") ||
        msg.includes("unavailable") ||
        msg.includes("deadline") ||
        msg.includes("500") ||
        msg.includes("internal") ||
        msg.includes("overloaded") ||
        msg.includes("rate") ||
        msg.includes("failed to fetch") ||
        msg.includes("networkerror") ||
        msg.includes("network") ||
        msg.includes("timeout") ||
        msg.includes("econnreset") ||
        msg.includes("socket") ||
        msg.includes("abort");

      if (is429) trackApiQuotaError();

      if (!isRetryable || attempt === maxRetries) throw error;

      const is503 =
        msg.includes("503") ||
        msg.includes("unavailable") ||
        msg.includes("overloaded");
      const isNetworkError =
        msg.includes("failed to fetch") ||
        msg.includes("network") ||
        msg.includes("timeout");

      const waitMs = is429
        ? Math.min(15000 * Math.pow(2, attempt), 60000) // 429: 15s → 30s → 60s
        : is503
        ? Math.min(baseDelay * Math.pow(2, attempt), 30000) // 503: 3s → 6s → 12s → 24s → 30s
        : isNetworkError
        ? baseDelay * (attempt + 1) * 2
        : baseDelay * (attempt + 1);

      console.warn(
        `[Gemini] 일시적 오류, ${waitMs / 1000}초 후 재시도 ` +
        `(${attempt + 1}/${maxRetries})...`,
        msg.substring(0, 120)
      );
      await new Promise<void>((r) => setTimeout(r, waitMs));
    }
  }
  // 이 코드는 실행될 수 없지만 TypeScript 반환 타입을 만족시키기 위해 필요합니다.
  throw new Error("withRetry: unreachable");
};

/**
 * 토큰 한도로 중간에 잘린 Gemini JSON 응답을 복구합니다.
 * 마크다운 코드 펜스 제거, 열린 괄호 닫기, 제어문자 정리를 수행합니다.
 *
 * @returns 파싱된 값, 복구 불가능한 경우 null
 */
export const repairTruncatedJSON = (raw: string): unknown | null => {
  let text = raw.trim();

  // 0) 마크다운 코드 펜스 제거
  text = text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  // 1) 문자열 내부에서 잘린 경우 처리 (홀수 따옴표)
  let quoteCount = 0;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    if (escaped) { escaped = false; continue; }
    if (text[i] === "\\") { escaped = true; continue; }
    if (text[i] === '"') quoteCount++;
  }
  if (quoteCount % 2 !== 0) {
    text = text.replace(/\\*$/, "") + '"';
  }

  // 2) 마지막 완전한 값까지 자르기
  for (let i = text.length - 1; i >= 0; i--) {
    const ch = text[i];
    if (
      ch === "}" ||
      ch === "]" ||
      ch === '"' ||
      ch === "e" || // true / false / null 의 끝
      ch === "l"
    ) {
      text = text.substring(0, i + 1);
      break;
    }
    if (/\d/.test(ch)) {
      text = text.substring(0, i + 1);
      break;
    }
  }

  // 3) 뒤쪽 불완전한 항목 제거 (콜론/쉼표/키만 있는 경우)
  text = text.replace(/,\s*"[^"]*"?\s*:?\s*$/, "");
  text = text.replace(/,\s*$/, "");

  // 4) 열린 괄호 수만큼 닫기 (스택 기반)
  const stack: string[] = [];
  let inString = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\" && inString) { esc = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  text = text.replace(/,\s*$/, "");
  while (stack.length > 0) text += stack.pop();

  // 5) 파싱 시도
  try {
    return JSON.parse(text);
  } catch {
    // 6) 추가 복구: 제어문자 제거 후 재시도
    try {
      const cleaned = text.replace(/[\x00-\x1f\x7f]/g, (ch) =>
        ch === "\n" || ch === "\r" || ch === "\t" ? ch : ""
      );
      return JSON.parse(cleaned);
    } catch {
      console.error(
        "[repairTruncatedJSON] 최종 복구 실패. 길이:",
        text.length,
        "끝 100자:",
        text.slice(-100)
      );
      return null;
    }
  }
};

/**
 * JSON 문자열을 파싱합니다. 실패하면 repairTruncatedJSON으로 복구를 시도합니다.
 * 마크다운 코드 펜스와 JSON 추출도 처리합니다.
 *
 * @param text - Gemini 응답 텍스트
 * @param fallback - 파싱 및 복구 모두 실패했을 때 반환할 기본값
 */
export const parseJsonSafely = <T>(text: string, fallback: T): T => {
  // 마크다운 코드 블록 제거 후 JSON 추출 시도
  const cleaned = text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  const jsonMatch = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  const candidate = jsonMatch ? jsonMatch[0] : cleaned;

  // 1차: 정상 파싱
  try {
    return JSON.parse(candidate) as T;
  } catch {
    // 2차: 잘린 JSON 복구 시도
    const repaired = repairTruncatedJSON(text);
    if (repaired !== null) {
      return repaired as T;
    }
    console.error(
      "[parseJsonSafely] JSON 파싱 및 복구 모두 실패:",
      text.slice(0, 200)
    );
    return fallback;
  }
};
