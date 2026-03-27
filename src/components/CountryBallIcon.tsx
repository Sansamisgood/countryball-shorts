'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  EmotionType,
  AnimationStyle,
  MouthFrame,
  SKETCHY_MOUTH_FRAMES,
  CLEAN_MOUTH_FRAMES,
} from '@/lib/types';

interface CountryBallIconProps {
  countryCode: string;
  size?: number;
  emotion?: EmotionType;
  style?: AnimationStyle;
  isTalking?: boolean;
}

// ─── Eye geometry per emotion ──────────────────────────────────────────────

interface EyeShape {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  pupilDx: number;
  pupilDy: number;
  pupilR: number;
}

interface EyeConfig {
  left: EyeShape;
  right: EyeShape;
}

function getEyeConfig(emotion: EmotionType): EyeConfig {
  switch (emotion) {
    case 'HAPPY':
      return {
        left:  { cx: 36, cy: 38, rx: 7, ry: 5, pupilDx: 0, pupilDy: 1, pupilR: 3 },
        right: { cx: 64, cy: 38, rx: 7, ry: 5, pupilDx: 0, pupilDy: 1, pupilR: 3 },
      };
    case 'ANGRY':
      return {
        left:  { cx: 36, cy: 37, rx: 7, ry: 6, pupilDx: 1,  pupilDy: 1, pupilR: 3.5 },
        right: { cx: 64, cy: 37, rx: 7, ry: 6, pupilDx: -1, pupilDy: 1, pupilR: 3.5 },
      };
    case 'SAD':
      return {
        left:  { cx: 36, cy: 40, rx: 7, ry: 6, pupilDx: 0, pupilDy: 2, pupilR: 3.5 },
        right: { cx: 64, cy: 40, rx: 7, ry: 6, pupilDx: 0, pupilDy: 2, pupilR: 3.5 },
      };
    case 'SURPRISED':
      return {
        left:  { cx: 35, cy: 37, rx: 9,  ry: 10, pupilDx: 0, pupilDy: 0, pupilR: 2 },
        right: { cx: 65, cy: 36, rx: 8,  ry: 9,  pupilDx: 0, pupilDy: 0, pupilR: 1.8 },
      };
    case 'NEUTRAL':
    default:
      return {
        left:  { cx: 36, cy: 38, rx: 7, ry: 7, pupilDx: 0, pupilDy: 0, pupilR: 3.5 },
        right: { cx: 64, cy: 38, rx: 7, ry: 7, pupilDx: 0, pupilDy: 0, pupilR: 3.5 },
      };
  }
}

// ─── Eyebrows per emotion ──────────────────────────────────────────────────

function EyeBrows({ emotion }: { emotion: EmotionType }) {
  switch (emotion) {
    case 'ANGRY':
      return (
        <>
          <line x1="29" y1="28" x2="43" y2="33" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="71" y1="28" x2="57" y2="33" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
        </>
      );
    case 'SAD':
      return (
        <>
          <line x1="29" y1="32" x2="43" y2="29" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
          <line x1="71" y1="32" x2="57" y2="29" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'SURPRISED':
      return (
        <>
          <path d="M 27 26 Q 36 21 44 26" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 56 26 Q 64 21 73 26" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
        </>
      );
    case 'HAPPY':
      return (
        <>
          <path d="M 29 30 Q 36 26 43 30" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
          <path d="M 57 30 Q 64 26 71 30" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    default:
      return null;
  }
}

// ─── Eye rendering with emotion-specific enhancements ──────────────────────

function Eye({
  shape,
  emotion,
  uid,
}: {
  shape: EyeShape;
  emotion: EmotionType;
  uid: string;
}) {
  const { cx, cy, rx, ry, pupilDx, pupilDy, pupilR } = shape;

  if (emotion === 'HAPPY') {
    return (
      <>
        {/* Crescent squint eye */}
        <path
          d={`M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy} Z`}
          fill="white"
          stroke="#1a1a1a"
          strokeWidth="1.5"
        />
        <circle cx={cx + pupilDx} cy={cy - 1} r={pupilR * 0.75} fill="#1a1a1a" />
        {/* Sparkle highlights */}
        <circle cx={cx + pupilDx + 2} cy={cy - 2} r={1.2} fill="white" className="cb-sparkle-a" />
        <circle cx={cx + pupilDx - 1} cy={cy - 3} r={0.7} fill="white" className="cb-sparkle-b" />
      </>
    );
  }

  if (emotion === 'ANGRY') {
    return (
      <>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="white" stroke="#1a1a1a" strokeWidth="1.5" />
        {/* Red vein tint around eyes */}
        <ellipse cx={cx} cy={cy} rx={rx - 1} ry={ry - 1} fill="rgba(220,50,50,0.12)" />
        {/* Sharper, larger pupil */}
        <circle cx={cx + pupilDx} cy={cy + pupilDy} r={pupilR} fill="#1a1a1a" />
        {/* Tiny red veins */}
        <line
          x1={cx - rx + 2} y1={cy - 1} x2={cx - rx + 5} y2={cy + 1}
          stroke="#cc3333" strokeWidth="0.6" opacity="0.7"
        />
        <line
          x1={cx + rx - 2} y1={cy - 2} x2={cx + rx - 5} y2={cy}
          stroke="#cc3333" strokeWidth="0.6" opacity="0.7"
        />
        <circle cx={cx + pupilDx + 1.5} cy={cy + pupilDy - 1.5} r={0.9} fill="white" />
      </>
    );
  }

  if (emotion === 'SAD') {
    const waterId = `cb-water-${uid}-${cx}`;
    return (
      <>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="white" stroke="#1a1a1a" strokeWidth="1.5" />
        {/* Watery bottom of eye */}
        <ellipse cx={cx} cy={cy + ry * 0.4} rx={rx - 1} ry={ry * 0.45} fill="#b8dff0" opacity="0.35">
          <animate attributeName="opacity" values="0.25;0.45;0.25" dur="2s" repeatCount="indefinite" />
        </ellipse>
        <circle cx={cx + pupilDx} cy={cy + pupilDy} r={pupilR} fill="#1a1a1a" />
        <circle cx={cx + pupilDx + 1.5} cy={cy + pupilDy - 1.5} r={0.9} fill="white" />
      </>
    );
  }

  if (emotion === 'SURPRISED') {
    return (
      <>
        {/* Extra-large eyes */}
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="white" stroke="#1a1a1a" strokeWidth="1.5" />
        {/* Tiny shrunken pupils */}
        <circle cx={cx + pupilDx} cy={cy + pupilDy} r={pupilR} fill="#1a1a1a" className="cb-surprised-pupil" />
        {/* Multiple sparkle highlights for shocked look */}
        <circle cx={cx + 2} cy={cy - 3} r={1.4} fill="white" />
        <circle cx={cx - 1.5} cy={cy - 1} r={0.8} fill="white" />
      </>
    );
  }

  // NEUTRAL: standard eye with blink animation
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="white" stroke="#1a1a1a" strokeWidth="1.5" />
      <circle cx={cx + pupilDx} cy={cy + pupilDy} r={pupilR} fill="#1a1a1a" />
      <circle cx={cx + pupilDx + 1.5} cy={cy + pupilDy - 1.5} r={0.9} fill="white" />
      {/* Blink lid overlay */}
      <ellipse
        cx={cx} cy={cy} rx={rx + 0.5} ry={0.5}
        fill="#1a1a1a"
        className="cb-blink"
      />
    </>
  );
}

// ─── Emotion visual effects (decorations around the ball) ──────────────────

function EmotionEffects({ emotion, uid }: { emotion: EmotionType; uid: string }) {
  switch (emotion) {
    case 'HAPPY':
      return (
        <g className="cb-fx-happy">
          {/* Sparkle stars floating around */}
          <g className="cb-sparkle-float-a">
            <polygon points="10,8 11,5 12,8 15,9 12,10 11,13 10,10 7,9" fill="#FFD700" opacity="0.9" />
          </g>
          <g className="cb-sparkle-float-b">
            <polygon points="85,12 86,9 87,12 90,13 87,14 86,17 85,14 82,13" fill="#FFD700" opacity="0.8" />
          </g>
          <g className="cb-sparkle-float-c">
            <polygon points="15,78 16,76 17,78 19,79 17,80 16,82 15,80 13,79" fill="#FFA500" opacity="0.7" />
          </g>
          <g className="cb-sparkle-float-d">
            <polygon points="80,75 81,73 82,75 84,76 82,77 81,79 80,77 78,76" fill="#FFD700" opacity="0.85" />
          </g>
        </g>
      );

    case 'ANGRY':
      return (
        <g className="cb-fx-angry">
          {/* Anger cross mark (top right) */}
          <g className="cb-anger-cross">
            <line x1="74" y1="8" x2="82" y2="16" stroke="#cc2222" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="82" y1="8" x2="74" y2="16" stroke="#cc2222" strokeWidth="2.5" strokeLinecap="round" />
          </g>
          {/* Steam puffs */}
          <circle cx="18" cy="14" r="3" fill="white" opacity="0.6" className="cb-steam-a" />
          <circle cx="14" cy="10" r="2.5" fill="white" opacity="0.5" className="cb-steam-b" />
          <circle cx="84" cy="20" r="2.5" fill="white" opacity="0.5" className="cb-steam-c" />
        </g>
      );

    case 'SAD':
      return (
        <g className="cb-fx-sad">
          {/* Animated tear drops from eyes */}
          <ellipse cx="33" cy="47" rx="2" ry="3" fill="#7ec8e3" opacity="0.85" className="cb-tear-l1" />
          <ellipse cx="67" cy="47" rx="2" ry="3" fill="#7ec8e3" opacity="0.85" className="cb-tear-r1" />
          {/* Rain drops falling around */}
          <line x1="15" y1="5" x2="14" y2="12" stroke="#a0d4e8" strokeWidth="1" strokeLinecap="round" className="cb-rain-a" />
          <line x1="30" y1="2" x2="29" y2="8" stroke="#a0d4e8" strokeWidth="1" strokeLinecap="round" className="cb-rain-b" />
          <line x1="70" y1="3" x2="69" y2="9" stroke="#a0d4e8" strokeWidth="1" strokeLinecap="round" className="cb-rain-c" />
          <line x1="85" y1="6" x2="84" y2="13" stroke="#a0d4e8" strokeWidth="1" strokeLinecap="round" className="cb-rain-d" />
          <line x1="50" y1="1" x2="49" y2="7" stroke="#a0d4e8" strokeWidth="1" strokeLinecap="round" className="cb-rain-e" />
        </g>
      );

    case 'SURPRISED':
      return (
        <g className="cb-fx-surprised">
          {/* Shock lines radiating outward */}
          <line x1="50" y1="0" x2="50" y2="6" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" className="cb-shock-a" />
          <line x1="10" y1="30" x2="4" y2="28" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" className="cb-shock-b" />
          <line x1="90" y1="30" x2="96" y2="28" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" className="cb-shock-c" />
          {/* Exclamation marks */}
          <g className="cb-exclaim-a">
            <rect x="87" y="8" width="2.5" height="8" rx="1" fill="#e03030" />
            <circle cx="88.25" cy="19" r="1.3" fill="#e03030" />
          </g>
          <g className="cb-exclaim-b">
            <rect x="8" y="10" width="2.5" height="8" rx="1" fill="#e03030" />
            <circle cx="9.25" cy="21" r="1.3" fill="#e03030" />
          </g>
        </g>
      );

    case 'NEUTRAL':
    default:
      return (
        <g className="cb-fx-neutral">
          {/* Subtle "zzz" */}
          <text x="78" y="18" fontSize="7" fill="#888" opacity="0.6" fontFamily="sans-serif" className="cb-zzz-a">z</text>
          <text x="83" y="12" fontSize="8" fill="#888" opacity="0.5" fontFamily="sans-serif" className="cb-zzz-b">z</text>
          <text x="89" y="7" fontSize="9" fill="#888" opacity="0.4" fontFamily="sans-serif" className="cb-zzz-c">z</text>
        </g>
      );
  }
}

// ─── CSS keyframes (embedded in SVG <style>) ──────────────────────────────

function getAnimationStyles(emotion: EmotionType, isTalking: boolean): string {
  const talkBounce = isTalking
    ? `
    @keyframes cb-talk-bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-1.5px); }
    }
    .cb-body-group { animation: cb-talk-bounce 0.15s ease-in-out infinite; }
    `
    : '';

  const base = `
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
      }
    }

    /* Sparkle pulse for happy eyes */
    @keyframes cb-sparkle-pulse {
      0%, 100% { opacity: 1; r: 1.2; }
      50% { opacity: 0.4; r: 0.6; }
    }
    .cb-sparkle-a { animation: cb-sparkle-pulse 1.2s ease-in-out infinite; }
    .cb-sparkle-b { animation: cb-sparkle-pulse 1.2s ease-in-out 0.4s infinite; }

    /* Neutral blink */
    @keyframes cb-blink-anim {
      0%, 90%, 100% { ry: 0.5; opacity: 0; }
      95% { ry: 7.5; opacity: 1; }
    }
    .cb-blink { animation: cb-blink-anim 4s ease-in-out infinite; }

    /* Surprised pupil throb */
    @keyframes cb-pupil-throb {
      0%, 100% { r: inherit; }
      50% { r: 1; }
    }

    ${talkBounce}
  `;

  switch (emotion) {
    case 'HAPPY':
      return base + `
        /* Body: upward bounce + squash/stretch */
        @keyframes cb-happy-bounce {
          0%, 100% { transform: translateY(0) scaleX(1) scaleY(1); }
          30% { transform: translateY(-3px) scaleX(0.97) scaleY(1.04); }
          60% { transform: translateY(0) scaleX(1.03) scaleY(0.97); }
        }
        .cb-body-group { animation: cb-happy-bounce 1.5s ease-in-out infinite; }

        /* Floating sparkles */
        @keyframes cb-float-a {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.9; }
          50% { transform: translate(2px, -4px) scale(1.3); opacity: 1; }
        }
        @keyframes cb-float-b {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.8; }
          50% { transform: translate(-3px, -3px) scale(1.2); opacity: 1; }
        }
        .cb-sparkle-float-a { animation: cb-float-a 2s ease-in-out infinite; }
        .cb-sparkle-float-b { animation: cb-float-b 2.3s ease-in-out 0.3s infinite; }
        .cb-sparkle-float-c { animation: cb-float-a 2.5s ease-in-out 0.6s infinite; }
        .cb-sparkle-float-d { animation: cb-float-b 2.1s ease-in-out 0.9s infinite; }
      `;

    case 'ANGRY':
      return base + `
        /* Body: vibrate/shake */
        @keyframes cb-angry-shake {
          0%, 100% { transform: translateX(0); }
          10% { transform: translateX(-1.5px); }
          20% { transform: translateX(1.5px); }
          30% { transform: translateX(-1px); }
          40% { transform: translateX(1px); }
          50% { transform: translateX(-0.5px); }
          60% { transform: translateX(0.5px); }
          70% { transform: translateX(0); }
        }
        .cb-body-group { animation: cb-angry-shake 0.8s ease-in-out infinite; }

        /* Anger cross throb */
        @keyframes cb-cross-throb {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.2); opacity: 1; }
        }
        .cb-anger-cross { animation: cb-cross-throb 0.6s ease-in-out infinite; transform-origin: 78px 12px; }

        /* Steam float */
        @keyframes cb-steam-rise {
          0% { transform: translateY(0); opacity: 0.6; }
          100% { transform: translateY(-8px); opacity: 0; }
        }
        .cb-steam-a { animation: cb-steam-rise 1.5s ease-out infinite; }
        .cb-steam-b { animation: cb-steam-rise 1.5s ease-out 0.5s infinite; }
        .cb-steam-c { animation: cb-steam-rise 1.5s ease-out 1s infinite; }
      `;

    case 'SAD':
      return base + `
        /* Body: slight shrink + droopy */
        @keyframes cb-sad-droop {
          0%, 100% { transform: translateY(1px) scale(0.97); }
          50% { transform: translateY(2.5px) scale(0.95); }
        }
        .cb-body-group { animation: cb-sad-droop 3s ease-in-out infinite; }

        /* Animated tear dripping */
        @keyframes cb-tear-drip {
          0% { transform: translateY(0); opacity: 0.9; }
          70% { transform: translateY(18px); opacity: 0.7; }
          100% { transform: translateY(24px); opacity: 0; }
        }
        .cb-tear-l1 { animation: cb-tear-drip 2s ease-in infinite; }
        .cb-tear-r1 { animation: cb-tear-drip 2s ease-in 0.7s infinite; }

        /* Rain drops falling */
        @keyframes cb-rain-fall {
          0% { transform: translateY(0); opacity: 0.7; }
          100% { transform: translateY(95px); opacity: 0; }
        }
        .cb-rain-a { animation: cb-rain-fall 1.8s linear infinite; }
        .cb-rain-b { animation: cb-rain-fall 1.6s linear 0.3s infinite; }
        .cb-rain-c { animation: cb-rain-fall 1.7s linear 0.6s infinite; }
        .cb-rain-d { animation: cb-rain-fall 1.9s linear 0.9s infinite; }
        .cb-rain-e { animation: cb-rain-fall 1.5s linear 1.2s infinite; }
      `;

    case 'SURPRISED':
      return base + `
        /* Body: quick pop scale-up + slight jump */
        @keyframes cb-surprised-pop {
          0% { transform: scale(1) translateY(0); }
          15% { transform: scale(1.08) translateY(-4px); }
          30% { transform: scale(0.98) translateY(0); }
          45% { transform: scale(1.02) translateY(-1px); }
          60%, 100% { transform: scale(1) translateY(0); }
        }
        .cb-body-group { animation: cb-surprised-pop 2s ease-out infinite; }

        /* Shock lines flash */
        @keyframes cb-shock-flash {
          0%, 60%, 100% { opacity: 0; }
          10%, 50% { opacity: 1; }
        }
        .cb-shock-a { animation: cb-shock-flash 2s ease-in-out infinite; }
        .cb-shock-b { animation: cb-shock-flash 2s ease-in-out 0.15s infinite; }
        .cb-shock-c { animation: cb-shock-flash 2s ease-in-out 0.3s infinite; }

        /* Exclamation bounce */
        @keyframes cb-exclaim-bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-3px) scale(1.15); }
        }
        .cb-exclaim-a { animation: cb-exclaim-bounce 0.8s ease-in-out infinite; }
        .cb-exclaim-b { animation: cb-exclaim-bounce 0.8s ease-in-out 0.4s infinite; }
      `;

    case 'NEUTRAL':
    default:
      return base + `
        /* Body: gentle idle breathing */
        @keyframes cb-idle-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.015); }
        }
        .cb-body-group { animation: cb-idle-breathe 4s ease-in-out infinite; }

        /* Zzz float */
        @keyframes cb-zzz-float {
          0% { transform: translateY(0); opacity: 0; }
          30% { opacity: 0.6; }
          100% { transform: translateY(-10px) translateX(3px); opacity: 0; }
        }
        .cb-zzz-a { animation: cb-zzz-float 3s ease-out infinite; }
        .cb-zzz-b { animation: cb-zzz-float 3s ease-out 1s infinite; }
        .cb-zzz-c { animation: cb-zzz-float 3s ease-out 2s infinite; }
      `;
  }
}

// ─── Red tint overlay for ANGRY ───────────────────────────────────────────

function AngryOverlay() {
  return (
    <circle cx="50" cy="50" r="46" fill="rgba(200,30,30,0.08)" />
  );
}

// ─── Mouth frame animation ──────────────────────────────────────────────────

const FRAME_INTERVAL_MS = 150;

function AnimatedMouth({
  emotion,
  style,
  isTalking,
}: {
  emotion: EmotionType;
  style: AnimationStyle;
  isTalking: boolean;
}) {
  const frames: MouthFrame[] =
    (style === 'GEN_SWAP'
      ? CLEAN_MOUTH_FRAMES[emotion]
      : SKETCHY_MOUTH_FRAMES[emotion]) ?? SKETCHY_MOUTH_FRAMES.NEUTRAL;

  const [frameIndex, setFrameIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (isTalking && frames.length > 1) {
      intervalRef.current = setInterval(() => {
        setFrameIndex((prev) => (prev + 1) % frames.length);
      }, FRAME_INTERVAL_MS);
    } else {
      setFrameIndex(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isTalking, frames.length, emotion, style]);

  const currentFrame = frames[frameIndex] ?? frames[0];

  return (
    <>
      {currentFrame.layers.map((layer, i) => (
        <path
          key={i}
          d={layer.d}
          fill={layer.fill}
          stroke={layer.stroke ?? 'none'}
          strokeWidth={layer.strokeWidth ?? 0}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </>
  );
}

// ─── Outline style per animation style ─────────────────────────────────────

function getBallStroke(style: AnimationStyle) {
  if (style === 'GEN_SWAP') {
    return { stroke: '#222', strokeWidth: 2 };
  }
  return { stroke: '#1a1a1a', strokeWidth: 3 };
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function CountryBallIcon({
  countryCode,
  size = 100,
  emotion = 'NEUTRAL',
  style = 'STOP_MOTION',
  isTalking = false,
}: CountryBallIconProps) {
  const reactId = useId();
  const uid = reactId.replace(/:/g, '');
  const clipId = `clip-ball-${uid}`;
  const eyeConfig = getEyeConfig(emotion);
  const ballStroke = getBallStroke(style);
  const animStyles = getAnimationStyles(emotion, isTalking);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', overflow: 'visible' }}
      role="img"
      aria-label={`Countryball for ${countryCode} feeling ${emotion.toLowerCase()}`}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r="46" />
        </clipPath>
      </defs>

      {/* Scoped CSS animations */}
      <style>{animStyles}</style>

      {/* Emotion decoration effects (outside the ball body) */}
      <EmotionEffects emotion={emotion} uid={uid} />

      {/* Body group: all body-level animations applied here */}
      <g className="cb-body-group" style={{ transformOrigin: '50px 50px' }}>
        {/* Flag image clipped to circle */}
        <image
          href={`https://flagcdn.com/w640/${countryCode.toLowerCase()}.png`}
          x="4"
          y="4"
          width="92"
          height="92"
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />

        {/* Red tint overlay for ANGRY */}
        {emotion === 'ANGRY' && <AngryOverlay />}

        {/* Ball outline */}
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke={ballStroke.stroke}
          strokeWidth={ballStroke.strokeWidth}
        />

        {/* Eyebrows */}
        <EyeBrows emotion={emotion} />

        {/* Eyes */}
        <Eye shape={eyeConfig.left} emotion={emotion} uid={uid} />
        <Eye shape={eyeConfig.right} emotion={emotion} uid={uid} />

        {/* Mouth */}
        <AnimatedMouth emotion={emotion} style={style} isTalking={isTalking} />
      </g>
    </svg>
  );
}
