/**
 * capcutExport.ts
 * CapCut (캡컷 / 剪映) 프로젝트 내보내기 서비스
 *
 * draft_content.json + 이미지 에셋을 ZIP으로 패키징하여
 * CapCut 데스크탑 앱의 프로젝트 폴더에 풀면 바로 열 수 있습니다.
 *
 * 씬(ScriptScene) + 스토리보드 이미지 → 비디오/자막 트랙 구성
 */

import type { ScriptScene, DialogueLine, EpisodePlan } from './types';

// ============================================================
// UUID 생성
// ============================================================
function uuid(): string {
  return 'XXXXXXXX-XXXX-4XXX-YXXX-XXXXXXXXXXXX'.replace(/[XY]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'X' ? r : (r & 0x3) | 0x8;
    return v.toString(16).toUpperCase();
  });
}

// ============================================================
// 시간 단위: 마이크로초 (CapCut 기본 단위)
// ============================================================
const SEC = 1_000_000; // 1초 = 1,000,000 마이크로초

/** 초 → 마이크로초 */
function toMicro(sec: number): number {
  return Math.round(sec * SEC);
}

/**
 * TTS 재생 시간 추정 (초)
 * 글자 수(공백 제외) × 0.18초, 최소 3초
 */
export function estimateDuration(text: string): number {
  const charCount = text.replace(/\s/g, '').length;
  return Math.max(3, Math.ceil(charCount * 0.18));
}

// ============================================================
// 자막 스타일
// ============================================================
interface SubtitleStyle {
  fontSize: number;
  fontColor: [number, number, number]; // RGB 0.0~1.0
  strokeColor: [number, number, number];
  strokeSize: number;
  bold: boolean;
}

const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontSize: 8.0,
  fontColor: [1.0, 1.0, 1.0], // 흰색
  strokeColor: [0.0, 0.0, 0.0], // 검정 테두리
  strokeSize: 0.04,
  bold: true,
};

function buildTextContent(text: string, style: SubtitleStyle = DEFAULT_SUBTITLE_STYLE): string {
  const inner = {
    styles: [
      {
        fill: {
          alpha: 1.0,
          content: {
            render_type: 'solid',
            solid: { color: style.fontColor },
          },
        },
        range: [0, text.length],
        size: style.fontSize,
        bold: style.bold,
        italic: false,
        underline: false,
        strokes: [
          {
            color: style.strokeColor,
            size: style.strokeSize,
          },
        ],
      },
    ],
    text,
  };
  return JSON.stringify(inner);
}

// ============================================================
// 내보내기 옵션
// ============================================================
export interface CapcutExportOptions {
  width: number;
  height: number;
  fps: number;
  subtitleStyle: SubtitleStyle;
  /** 이미지 없는 씬의 기본 표시 시간 (초) */
  imageDurationFallback: number;
}

const DEFAULT_OPTIONS: CapcutExportOptions = {
  width: 1080,
  height: 1920, // 9:16 (쇼츠 기본 포맷)
  fps: 30,
  subtitleStyle: DEFAULT_SUBTITLE_STYLE,
  imageDurationFallback: 4,
};

// ============================================================
// 메인 내보내기 함수
// ============================================================

/**
 * countryball 씬 배열을 CapCut 프로젝트 ZIP으로 내보냅니다.
 *
 * @param scenes - 완성된 ScriptScene 배열
 * @param storyboardImages - sceneNumber → base64 이미지 URL Map
 * @param projectTitle - ZIP 파일명 및 프로젝트명으로 사용
 * @param options - 캔버스 크기, FPS 등 옵션
 */
export async function exportToCapcut(
  scenes: ScriptScene[],
  storyboardImages: Map<number, string>,
  projectTitle: string,
  options: Partial<CapcutExportOptions> = {}
): Promise<void> {
  const opts: CapcutExportOptions = { ...DEFAULT_OPTIONS, ...options };

  const JSZipModule = await import('jszip');
  const JSZip = JSZipModule.default;
  const zip = new JSZip();
  const mediaFolder = zip.folder('media');
  const now = Math.floor(Date.now() / 1000);
  const projectId = uuid();

  // ---- 매터리얼 수집기 ----
  const materialsVideos: unknown[] = [];
  const materialsTexts: unknown[] = [];
  const materialsSpeeds: unknown[] = [];
  const materialsCanvases: unknown[] = [];
  const materialsAnimations: unknown[] = [];

  const videoSegments: unknown[] = [];
  const textSegments: unknown[] = [];
  let timelinePos = 0; // 현재 타임라인 위치 (마이크로초)

  // 기본 캔버스 매터리얼
  const canvasId = uuid();
  materialsCanvases.push({
    album_image: '',
    blur: 0.0,
    color: '',
    id: canvasId,
    image: '',
    image_id: '',
    image_name: '',
    source_platform: 0,
    team_id: '',
    type: 'canvas_color',
  });

  // ---- 씬별 처리 ----
  for (const scene of scenes) {
    const imageUrl = storyboardImages.get(scene.sceneNumber);

    // 대사 텍스트 전체 합치기 (재생 시간 추정용)
    const allDialogueText = scene.dialogue
      .map((d: DialogueLine) => `${d.speaker}: ${d.text}`)
      .join(' ');

    // 씬 표시 시간 결정: 명시된 durationSec → 대사 추정 → 기본값
    const sceneDurationSec =
      scene.durationSec > 0
        ? scene.durationSec
        : allDialogueText.trim()
        ? estimateDuration(allDialogueText)
        : opts.imageDurationFallback;
    const sceneDurationMicro = toMicro(sceneDurationSec);

    // ---- 이미지 → 비디오 매터리얼 ----
    if (imageUrl) {
      const imageData = base64ToUint8Array(imageUrl);
      const imageFileName = `scene_${scene.sceneNumber}.png`;
      mediaFolder?.file(imageFileName, imageData);

      const videoMatId = uuid();
      materialsVideos.push({
        id: videoMatId,
        type: 'photo',
        path: `media/${imageFileName}`,
        material_name: imageFileName,
        duration: sceneDurationMicro,
        width: opts.width,
        height: opts.height,
        create_time: now,
        crop: {
          lower_left_x: 0.0, lower_left_y: 1.0,
          lower_right_x: 1.0, lower_right_y: 1.0,
          upper_left_x: 0.0, upper_left_y: 0.0,
          upper_right_x: 1.0, upper_right_y: 0.0,
        },
        category_id: '',
        category_name: 'local',
        check_flag: 63487,
        crop_ratio: -1.0,
        crop_scale: 1.0,
        extra_type_option: 0,
        formula_id: '',
        freeze: null,
        gameplay: null,
        has_audio: false,
        height_field: opts.height,
        width_field: opts.width,
        intensifies_audio_path: '',
        intensifies_path: '',
        is_ai_generate_content: false,
        is_copyright: false,
        is_unified_beauty_mode: false,
        is_text_edit_overdub: false,
        local_id: '',
        local_material_id: '',
        matting: {
          flag: 0,
          has_use_quick_brush: false,
          has_use_quick_eraser: false,
          interactiveTime: [],
          path: '',
          strokes: [],
        },
        media_path: '',
        object_id: '',
        origin_material_id: '',
        picture_from: 'none',
        picture_set_category_id: '',
        picture_set_category_name: '',
        request_id: '',
        reverse_intensifies_path: '',
        reverse_path: '',
        smart_motion: null,
        source: 0,
        source_platform: 0,
        stable: {
          matrix_path: '',
          stable_level: 0,
          time_range: { duration: 0, start: 0 },
        },
        team_id: '',
        video_algorithm: {
          algorithms: [],
          deflicker: null,
          motion_blur_config: null,
          noise_reduction: null,
          path: '',
          quality_enhance: null,
          time_range: null,
        },
      });

      // Speed 매터리얼
      const speedId = uuid();
      materialsSpeeds.push({
        id: speedId,
        mode: 0,
        name: '',
        speed: 1.0,
        type: 'speed',
      });

      // Animation 매터리얼
      const animId = uuid();
      materialsAnimations.push({
        id: animId,
        animations: [],
        type: 'sticker_animation',
      });

      // 비디오 세그먼트
      videoSegments.push({
        id: uuid(),
        material_id: videoMatId,
        target_timerange: {
          start: timelinePos,
          duration: sceneDurationMicro,
        },
        source_timerange: {
          start: 0,
          duration: sceneDurationMicro,
        },
        speed: 1.0,
        volume: 1.0,
        common_keyframes: [],
        enable_adjust: true,
        enable_color_correct_adjust: false,
        enable_color_curves: true,
        enable_color_match_adjust: false,
        enable_color_wheels: true,
        enable_lut: true,
        enable_smart_color_adjust: false,
        extra_material_refs: [speedId, animId, canvasId],
        is_tone_modify: false,
        keyframe_refs: [],
        last_nonzero_volume: 1.0,
        render_index: 0,
        reverse: false,
        track_attribute: 0,
        track_render_index: 0,
        visible: true,
        clip: {
          alpha: 1.0,
          flip: { horizontal: false, vertical: false },
          rotation: 0.0,
          scale: { x: 1.0, y: 1.0 },
          transform: { x: 0.0, y: 0.0 },
        },
        uniform_scale: { on: true, value: 1.0 },
        cartoon: false,
        caption_info: null,
        hdr_settings: { intensity: 1.0, mode: 1, nits: 1000 },
      });
    }

    // ---- 자막 세그먼트 ----
    if (scene.dialogue.length > 0) {
      const lineDurationMicro = Math.floor(sceneDurationMicro / scene.dialogue.length);
      let linePos = timelinePos;

      for (const line of scene.dialogue) {
        const lineText = `${line.speaker}: ${line.text}`;
        if (!lineText.trim()) {
          linePos += lineDurationMicro;
          continue;
        }

        const textMatId = uuid();
        materialsTexts.push({
          id: textMatId,
          type: 'subtitle',
          add_type: 0,
          alignment: 1, // 가운데 정렬
          background_alpha: 0.5,
          background_color: '',
          background_height: 0.14,
          background_horizontal_offset: 0.0,
          background_round_radius: 0.0,
          background_style: 0,
          background_vertical_offset: 0.004,
          background_width: 0.14,
          base_content: '',
          bold_width: 0.0,
          border_alpha: 1.0,
          border_color: '',
          border_width: 0.08,
          caption_template_info: {
            category_id: '', category_name: '', effect_id: '',
            is_new: false, path: '', request_id: '',
            resource_id: '', resource_name: '', source_platform: 0,
          },
          check_flag: 7,
          combo_info: { text_templates: [] },
          content: buildTextContent(lineText, opts.subtitleStyle),
          fixed_height: -1.0,
          fixed_width: -1.0,
          font_category_id: '',
          font_category_name: '',
          font_id: '',
          font_name: '',
          font_path: '',
          font_resource_id: '',
          font_size: opts.subtitleStyle.fontSize,
          font_source_platform: 0,
          font_team_id: '',
          font_title: 'System Default',
          font_url: '',
          fonts: [],
          force_apply_line_max_width: false,
          global_alpha: 1.0,
          group_id: '',
          has_shadow: false,
          initial_scale: 1.0,
          inner_padding: -1.0,
          is_rich_text: false,
          italic_degree: 0,
          ktv_color: '',
          language: '',
          layer_weight: 1,
          letter_spacing: 0.0,
          line_feed: 1,
          line_max_width: 0.82,
          line_spacing: 0.02,
          multi_language_current: 'none',
          name: '',
          original_size: [],
          preset_category: '',
          preset_category_id: '',
          preset_has_set_alignment: false,
          preset_id: '',
          preset_index: 0,
          preset_name: '',
          recognize_task_id: '',
          recognize_type: 0,
          relevance_segment: [],
          shadow_alpha: 0.9,
          shadow_angle: -45.0,
          shadow_color: '',
          shadow_distance: 0.02,
          shadow_point: { x: 0.6401844, y: -0.6401844 },
          shadow_smoothing: 0.45,
          shape_clip_x: false,
          shape_clip_y: false,
          source_from: '',
          style_name: '',
          sub_type: 0,
          subtitle_keywords: null,
          text_alpha: 1.0,
          text_color: '#FFFFFF',
          text_curve: null,
          text_preset_resource_id: '',
          text_size: opts.subtitleStyle.fontSize,
          text_to_audio_ids: [],
          tts_auto_update: false,
          typesetting: 0,
          underline: false,
          underline_offset: 0.22,
          underline_width: 0.05,
          use_effect_default_color: true,
          words: { end_time: [], start_time: [], text: [] },
        });

        textSegments.push({
          id: uuid(),
          material_id: textMatId,
          target_timerange: {
            start: linePos,
            duration: lineDurationMicro,
          },
          common_keyframes: [],
          enable_adjust: false,
          enable_color_correct_adjust: false,
          enable_color_curves: true,
          enable_color_match_adjust: false,
          enable_color_wheels: true,
          enable_lut: false,
          enable_smart_color_adjust: false,
          extra_material_refs: [],
          keyframe_refs: [],
          last_nonzero_volume: 1.0,
          render_index: 0,
          reverse: false,
          track_attribute: 0,
          track_render_index: 11000,
          visible: true,
          clip: {
            alpha: 1.0,
            flip: { horizontal: false, vertical: false },
            rotation: 0.0,
            scale: { x: 1.0, y: 1.0 },
            transform: { x: 0.0, y: -0.78 }, // 하단 자막 위치
          },
          uniform_scale: { on: true, value: 1.0 },
        });

        linePos += lineDurationMicro;
      }
    } else if (scene.directorNote?.trim()) {
      // 대사 없는 씬은 감독 노트를 나레이션 자막으로 표시
      const textMatId = uuid();
      const noteText = scene.directorNote.trim();

      materialsTexts.push({
        id: textMatId,
        type: 'subtitle',
        add_type: 0,
        alignment: 1,
        background_alpha: 0.5,
        background_color: '',
        background_height: 0.14,
        background_horizontal_offset: 0.0,
        background_round_radius: 0.0,
        background_style: 0,
        background_vertical_offset: 0.004,
        background_width: 0.14,
        base_content: '',
        bold_width: 0.0,
        border_alpha: 1.0,
        border_color: '',
        border_width: 0.08,
        caption_template_info: {
          category_id: '', category_name: '', effect_id: '',
          is_new: false, path: '', request_id: '',
          resource_id: '', resource_name: '', source_platform: 0,
        },
        check_flag: 7,
        combo_info: { text_templates: [] },
        content: buildTextContent(noteText, opts.subtitleStyle),
        fixed_height: -1.0,
        fixed_width: -1.0,
        font_category_id: '',
        font_category_name: '',
        font_id: '',
        font_name: '',
        font_path: '',
        font_resource_id: '',
        font_size: opts.subtitleStyle.fontSize,
        font_source_platform: 0,
        font_team_id: '',
        font_title: 'System Default',
        font_url: '',
        fonts: [],
        force_apply_line_max_width: false,
        global_alpha: 1.0,
        group_id: '',
        has_shadow: false,
        initial_scale: 1.0,
        inner_padding: -1.0,
        is_rich_text: false,
        italic_degree: 0,
        ktv_color: '',
        language: '',
        layer_weight: 1,
        letter_spacing: 0.0,
        line_feed: 1,
        line_max_width: 0.82,
        line_spacing: 0.02,
        multi_language_current: 'none',
        name: '',
        original_size: [],
        preset_category: '',
        preset_category_id: '',
        preset_has_set_alignment: false,
        preset_id: '',
        preset_index: 0,
        preset_name: '',
        recognize_task_id: '',
        recognize_type: 0,
        relevance_segment: [],
        shadow_alpha: 0.9,
        shadow_angle: -45.0,
        shadow_color: '',
        shadow_distance: 0.02,
        shadow_point: { x: 0.6401844, y: -0.6401844 },
        shadow_smoothing: 0.45,
        shape_clip_x: false,
        shape_clip_y: false,
        source_from: '',
        style_name: '',
        sub_type: 0,
        subtitle_keywords: null,
        text_alpha: 1.0,
        text_color: '#FFFFFF',
        text_curve: null,
        text_preset_resource_id: '',
        text_size: opts.subtitleStyle.fontSize,
        text_to_audio_ids: [],
        tts_auto_update: false,
        typesetting: 0,
        underline: false,
        underline_offset: 0.22,
        underline_width: 0.05,
        use_effect_default_color: true,
        words: { end_time: [], start_time: [], text: [] },
      });

      textSegments.push({
        id: uuid(),
        material_id: textMatId,
        target_timerange: {
          start: timelinePos,
          duration: sceneDurationMicro,
        },
        common_keyframes: [],
        enable_adjust: false,
        enable_color_correct_adjust: false,
        enable_color_curves: true,
        enable_color_match_adjust: false,
        enable_color_wheels: true,
        enable_lut: false,
        enable_smart_color_adjust: false,
        extra_material_refs: [],
        keyframe_refs: [],
        last_nonzero_volume: 1.0,
        render_index: 0,
        reverse: false,
        track_attribute: 0,
        track_render_index: 11000,
        visible: true,
        clip: {
          alpha: 1.0,
          flip: { horizontal: false, vertical: false },
          rotation: 0.0,
          scale: { x: 1.0, y: 1.0 },
          transform: { x: 0.0, y: -0.78 },
        },
        uniform_scale: { on: true, value: 1.0 },
      });
    }

    timelinePos += sceneDurationMicro;
  }

  // ---- 트랙 구성 ----
  const tracks: unknown[] = [];

  if (videoSegments.length > 0) {
    tracks.push({
      attribute: 0,
      flag: 0,
      id: uuid(),
      is_default_name: true,
      name: '',
      segments: videoSegments,
      type: 'video',
      render_index: 0,
    });
  }

  if (textSegments.length > 0) {
    tracks.push({
      attribute: 0,
      flag: 0,
      id: uuid(),
      is_default_name: true,
      name: '',
      segments: textSegments,
      type: 'text',
      render_index: 11000,
    });
  }

  // ---- draft_content.json 조립 ----
  const ratio = opts.width > opts.height ? '16:9' : '9:16';

  const draftContent = {
    canvas_config: {
      height: opts.height,
      ratio,
      width: opts.width,
    },
    color_space: 0,
    config: {
      adjust_max_index: 1,
      attachment_info: [],
      combination_max_index: 1,
      export_range: null,
      extract_audio_last_index: 1,
      lyrics_recognition_id: '',
      lyrics_sync: true,
      lyrics_taskinfo: [],
      maintrack_adsorb: true,
      material_save_mode: 0,
      multi_language_current: 'none',
      multi_language_list: [],
      multi_language_main: 'none',
      multi_language_mode: 'none',
      original_sound_last_index: 1,
      record_audio_last_index: 1,
      sticker_max_index: 1,
      subtitle_keywords_config: null,
      subtitle_recognition_id: '',
      subtitle_sync: true,
      subtitle_taskinfo: [],
      system_font_list: [],
      video_mute: false,
      zoom_info_params: null,
    },
    cover: null,
    create_time: now,
    duration: timelinePos,
    extra_info: null,
    fps: opts.fps * 1.0,
    free_render_index_mode_on: false,
    group_container: null,
    id: projectId,
    keyframe_graph_list: [],
    keyframes: {
      adjusts: [], audios: [], effects: [], filters: [],
      handwrites: [], stickers: [], texts: [], videos: [],
    },
    last_modified_platform: {
      app_id: 3704,
      app_source: 'lv',
      app_version: '5.9.0',
      os: 'windows',
    },
    platform: {
      app_id: 3704,
      app_source: 'lv',
      app_version: '5.9.0',
      os: 'windows',
    },
    materials: {
      ai_translates: [],
      audio_balances: [],
      audio_effects: [],
      audio_fades: [],
      audios: [],
      beats: [],
      canvases: materialsCanvases,
      chromas: [],
      color_curves: [],
      digital_humans: [],
      drafts: [],
      effects: [],
      flowers: [],
      green_screens: [],
      handwrites: [],
      head_turning: [],
      images: [],
      log_color_wheels: [],
      loudnesses: [],
      manual_deformations: [],
      masks: [],
      material_animations: materialsAnimations,
      material_colors: [],
      multi_language_refs: [],
      placeholders: [],
      plugin_effects: [],
      realtime_denoises: [],
      smart_crops: [],
      smart_relights: [],
      sound_channel_mappings: [],
      speeds: materialsSpeeds,
      stickers: [],
      tail_leaders: [],
      text_templates: [],
      texts: materialsTexts,
      transitions: [],
      video_effects: [],
      video_trackings: [],
      videos: materialsVideos,
      vocal_beautifys: [],
      vocal_separations: [],
    },
    mutable_config: null,
    name: projectTitle || 'Countryball Shorts',
    new_version: '110.0.0',
    relationships: [],
    render_index_track_mode_on: false,
    retouch_cover: null,
    source: 'default',
    static_cover_image_path: '',
    time_marks: null,
    tracks,
    update_time: now,
    version: 360000,
  };

  // ---- draft_meta_info.json ----
  const draftMeta = {
    draft_fold_path: '',
    draft_id: projectId,
    draft_name: projectTitle || 'Countryball Shorts',
    draft_removable_storage_device: '',
    draft_root_path: '',
    draft_segment_extra_info: null,
    draft_timeline_materials_size_: 0,
    tm_draft_create: now,
    tm_draft_modified: now,
    tm_duration: timelinePos,
  };

  // ---- ZIP 패키징 ----
  zip.file('draft_content.json', JSON.stringify(draftContent, null, 2));
  zip.file('draft_meta_info.json', JSON.stringify(draftMeta, null, 2));

  // ---- 파일 다운로드 ----
  const blob = await zip.generateAsync({ type: 'blob' });
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const safeTitle = (projectTitle || 'project').replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
  const fileName = `${dateStr}-${safeTitle}_capcut.zip`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ============================================================
// 헬퍼: base64 data URL → Uint8Array
// ============================================================
function base64ToUint8Array(dataUrl: string): Uint8Array {
  // CDN/HTTP URL은 빈 배열 반환 (ZIP 패키징 스킵)
  if (
    dataUrl.startsWith('http://') ||
    dataUrl.startsWith('https://') ||
    dataUrl.startsWith('blob:')
  ) {
    console.warn('[CapCut Export] 외부 URL은 base64 변환 불가, 스킵:', dataUrl.substring(0, 80));
    return new Uint8Array(0);
  }

  const raw = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const binaryString = atob(raw);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// ============================================================
// 내보내기 가능 여부 확인
// ============================================================

/**
 * 내보내기 가능 여부 확인
 * 씬이 1개 이상이고 스토리보드 이미지가 하나라도 있으면 true
 */
export function canExportToCapcut(
  scenes: ScriptScene[],
  storyboardImages: Map<number, string>
): boolean {
  return scenes.length > 0 && storyboardImages.size > 0;
}

/**
 * 전체 프로젝트 예상 재생 시간 반환 (초)
 */
export function estimateTotalDuration(
  scenes: ScriptScene[],
  fallbackSec = DEFAULT_OPTIONS.imageDurationFallback
): number {
  return scenes.reduce((total, scene) => {
    if (scene.durationSec > 0) return total + scene.durationSec;
    const allText = scene.dialogue.map((d) => d.text).join(' ');
    return total + (allText.trim() ? estimateDuration(allText) : fallbackSec);
  }, 0);
}

// EpisodePlan을 받아 프로젝트 제목 문자열을 만드는 유틸
export function buildProjectTitle(plan: EpisodePlan | null): string {
  return plan?.title || 'Countryball Shorts';
}
