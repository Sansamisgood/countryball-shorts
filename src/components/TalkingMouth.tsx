'use client';

import { useEffect, useRef, useState } from 'react';
import {
  EmotionType,
  AnimationStyle,
  MouthFrame,
  SKETCHY_MOUTH_FRAMES,
  CLEAN_MOUTH_FRAMES,
} from '@/lib/types';

interface TalkingMouthProps {
  emotion: EmotionType;
  style: AnimationStyle;
  isTalking: boolean;
  size?: number;
}

const FRAME_INTERVAL_MS = 150;

export default function TalkingMouth({
  emotion,
  style,
  isTalking,
  size = 100,
}: TalkingMouthProps) {
  const frames: MouthFrame[] =
    style === 'GEN_SWAP'
      ? CLEAN_MOUTH_FRAMES[emotion]
      : SKETCHY_MOUTH_FRAMES[emotion];

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
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isTalking, frames.length, emotion, style]);

  const currentFrame = frames[frameIndex] ?? frames[0];
  const scale = size / 100;

  return (
    <g transform={`scale(${scale})`} style={{ transformOrigin: '50px 57px' }}>
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
    </g>
  );
}
