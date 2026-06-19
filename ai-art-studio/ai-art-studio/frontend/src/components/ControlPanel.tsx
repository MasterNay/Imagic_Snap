'use client';

import { useState, useEffect } from 'react';
import { useCameraStore } from '@/store/cameraStore';
import styles from './ControlPanel.module.css';

interface Props {
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
  setGeneratedImage: (v: string | null) => void;
  setJobId: (v: string | null) => void;
}

interface StylePreset {
  id: string;
  name: string;
  nameTh: string;
  emoji: string;
  prompt: string;
  negativePrompt: string;
  controlMode: string;
  model: string;
  conditioningScale: number;
  steps: number;
  guidanceScale: number;
}

const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'anime',
    name: 'Anime Art',
    nameTh: 'ลายเส้นอนิเมะ',
    emoji: '🌸',
    prompt: 'A beautiful anime art version of the person. Strictly preserve their facial features, eyes, expression, and pose, but render them with flawless smooth skin, clean hand-drawn line art, vibrant colors, in a high-quality Studio Ghibli style with a detailed anime scenery background.',
    negativePrompt: 'photorealistic, blurry, low quality, 3d render, distorted, ugly, realistic skin, wrinkles, blemishes, facial lines, age spots, acne, rough skin texture, eyebags, dark circles, aged, old look',
    controlMode: 'canny',
    model: 'flux',
    conditioningScale: 0.55,
    steps: 20,
    guidanceScale: 3.5,
  },
  {
    id: 'watercolor',
    name: 'Watercolor',
    nameTh: 'ภาพสีน้ำ',
    emoji: '🎨',
    prompt: 'An elegant watercolor painting of the person. Strictly preserve their facial identity, expression, and pose. The face must be rendered with smooth, clean artistic strokes, flawless glowing skin, and soft lighting. Beautiful fluid color blending, artistic paint splatters in the background, and a subtle overall classic paper texture.',
    negativePrompt: 'photorealistic, low quality, blurry, hard outlines, bad anatomy, deformed, 3d render, wrinkles, blemishes, facial lines, age spots, acne, rough skin texture, eyebags, dark circles, aged, old look',
    controlMode: 'depth',
    model: 'flux',
    conditioningScale: 0.55,
    steps: 20,
    guidanceScale: 3.5,
  },
  {
    id: 'comic',
    name: 'Retro Comic',
    nameTh: 'การ์ตูนคอมิกส์',
    emoji: '💥',
    prompt: 'A vintage comic book portrait of the person. Strictly preserve their face, expression, and pose, but redraw them in a classic retro comic book style with clean bold black ink outlines and vibrant pop art colors. The face must have clean and smooth skin shading, with halftone dot patterns applied mainly to the background.',
    negativePrompt: 'photorealistic, blurry, low quality, 3d render, smooth photorealistic gradients, realistic skin, wrinkles, blemishes, heavy facial lines, age spots, acne, rough skin texture, eyebags, dark circles, aged, old look, dirty face, messy shading',
    controlMode: 'canny',
    model: 'flux',
    conditioningScale: 0.60,
    steps: 20,
    guidanceScale: 3.5,
  },
  {
    id: 'popart',
    name: 'Pop Art',
    nameTh: 'ป๊อปอาร์ต',
    emoji: '🕶️',
    prompt: 'An Andy Warhol style pop art portrait of the person. Strictly preserve their facial features, expression, and pose, but render them with clean flat vector colors, smooth crisp outlines, and high contrast iconic retro art style. The face must be clean, neat, and free of heavy artifacts.',
    negativePrompt: 'photorealistic, smooth gradients, blurry, low quality, realistic 3d, shadows, wrinkles, blemishes, facial lines, age spots, acne, rough skin texture, eyebags, dark circles, aged, old look, messy spots, facial shadows',
    controlMode: 'canny',
    model: 'flux',
    conditioningScale: 0.55,
    steps: 20,
    guidanceScale: 3.5,
  },
{
    id: 'cyberpunk_subtle',
    name: 'Cyberpunk (Subtle)',
    nameTh: 'ไซเบอร์พังก์ (เน้นโครงเดิม)',
    emoji: '🌆',
    prompt: 'A cyberpunk-style portrait using image_1.png as the strict foundation. The subject is the exact Asian man with his precise facial features and distinctive curly hair, maintaining his neutral expression and specific close-up pose. Render with intense, directional neon light reflections, casting rich cyan and magenta hues directly across his skin and hair. The existing background from image_1.png (air conditioner, shelves) must be clearly visible, but viewed through a hazy, rain-streaked window pane. Reflecting on the glass are fragmented holographic projections of abstract kanji characters and geometric light patterns (derived from text in image_2.png), as if a dense cityscape is just outside. He wears a subtle, data-patterned high-collar jacket over his existing shirt silhouette. The overall aesthetic must maintain the quiet composition of the original photo but be saturated with cyberpunk atmosphere. High realism, precise fidelity.',
    negativePrompt: 'caucasian, western face, white person, changed face, altered facial features, model face, different person, aggressive expression, completely different background, changing the location, landscape view, moving arms, changed pose, pastoral, illustration, painting, blurry, low quality',
    controlMode: 'canny',
    model: 'flux',
    conditioningScale: 0.70,
    steps: 25,
    guidanceScale: 4.0,
  },
  {
    id: 'pixel',
    name: 'Pixel Art',
    nameTh: 'ภาพพิกเซล',
    emoji: '👾',
    prompt: 'A vibrant 16-bit retro pixel art portrait of the exact Asian person. Strictly preserve their facial identity, expression, and pose, but transform them into a clean video game character. Distinct blocky pixel grid, vibrant retro color palette, sharp aliased lines, clean pixel shading, and a stylized gaming background.',
    negativePrompt: 'photorealistic, smooth gradients, blurry, low quality, 3d render, anti-aliased, realistic skin texture, wrinkles, facial lines, blemishes, aged, old look, caucasian, western face, european features, bad anatomy',
    controlMode: 'canny',
    model: 'flux',
    conditioningScale: 0.55,
    steps: 20,
    guidanceScale: 3.5,
  }
];

const CONTROLNET_MODES = [
  { value: 'canny', label: 'Canny Edge' },
  { value: 'depth', label: 'Depth Map' },
  { value: 'pose', label: 'OpenPose' },
  { value: 'hed', label: 'HED Softedge' },
  { value: 'normal', label: 'Normal Map' },
];

const MODELS = [
  { value: 'flux', label: 'FLUX.1-Dev' },
  { value: 'sdxl', label: 'SDXL 1.0' },
  { value: 'sd15', label: 'SD 1.5' },
];

export default function ControlPanel({ isGenerating, setIsGenerating, setGeneratedImage, setJobId }: Props) {
  const { capturedImage, frameData } = useCameraStore();

  const [selectedStyleId, setSelectedStyleId] = useState<string>('anime');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [controlMode, setControlMode] = useState('canny');
  const [model, setModel] = useState('flux');
  const [controlScale, setControlScale] = useState(0.7);
  const [steps, setSteps] = useState(20);
  const [guidanceScale, setGuidanceScale] = useState(3.5);
  const [seed, setSeed] = useState(-1);
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [liveInterval, setLiveIntervalRef] = useState<NodeJS.Timeout | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Apply selected style preset
  const applyPreset = (preset: StylePreset) => {
    setSelectedStyleId(preset.id);
    setPrompt(preset.prompt);
    setNegativePrompt(preset.negativePrompt);
    setControlMode(preset.controlMode);
    setModel(preset.model);
    setControlScale(preset.conditioningScale);
    setSteps(preset.steps);
    setGuidanceScale(preset.guidanceScale);
  };

  // Set default preset on mount
  useEffect(() => {
    const defaultPreset = STYLE_PRESETS.find((p) => p.id === 'anime');
    if (defaultPreset) applyPreset(defaultPreset);
  }, []);

  const generate = async (frameOverride?: string | null) => {
    // Enforce snapshot image first, fallback to live frame data if really needed
    const frame = frameOverride ?? capturedImage ?? frameData;
    if (!frame) {
      alert('กรุณาเปิดกล้องและถ่ายรูปก่อนแปลงสไตล์ภาพครับ');
      return;
    }

    setIsGenerating(true);
    setJobId(null);

    try {
      const res = await fetch(`${API_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: frame.split(',')[1], // base64 without prefix
          prompt,
          negative_prompt: negativePrompt,
          control_mode: controlMode,
          model,
          controlnet_conditioning_scale: controlScale,
          num_inference_steps: steps,
          guidance_scale: guidanceScale,
          seed: seed === -1 ? Math.floor(Math.random() * 2 ** 32) : seed,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`API error ${res.status}:`, errBody);
        throw new Error(`API error: ${res.status} — ${errBody}`);
      }

      const data = await res.json();
      setJobId(data.job_id);

      // Poll for result
      await pollJob(data.job_id);
    } catch (err) {
      console.error('Generation failed:', err);
      alert(`Generation failed: ${err instanceof Error ? err.message : String(err)}`);
      setIsGenerating(false);
    }
  };

  const pollJob = async (jobId: string) => {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async (): Promise<void> => {
      if (attempts >= maxAttempts) {
        setIsGenerating(false);
        return;
      }
      attempts++;

      try {
        const res = await fetch(`${API_URL}/job/${jobId}`);
        const data = await res.json();

        if (data.status === 'completed') {
          setGeneratedImage(`data:image/png;base64,${data.result_image}`);
          setIsGenerating(false);
        } else if (data.status === 'failed') {
          console.error('Job failed:', data.error);
          setIsGenerating(false);
        } else {
          // Still pending
          await new Promise((r) => setTimeout(r, 1000));
          return poll();
        }
      } catch {
        await new Promise((r) => setTimeout(r, 1500));
        return poll();
      }
    };

    return poll();
  };

  const toggleLiveMode = () => {
    if (liveMode) {
      if (liveInterval) clearInterval(liveInterval);
      setLiveIntervalRef(null);
      setLiveMode(false);
    } else {
      setLiveMode(true);
      const iv = setInterval(() => {
        if (!isGenerating) {
          generate();
        }
      }, 3000);
      setLiveIntervalRef(iv);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>SELECT ART STYLE / เลือกสไตล์ภาพ</span>
      </div>

      {/* Grid of Styles */}
      <div className={styles.styleGrid}>
        {STYLE_PRESETS.map((preset) => {
          const isSelected = selectedStyleId === preset.id;
          return (
            <button
              key={preset.id}
              className={`${styles.styleCard} ${isSelected ? styles.styleCardActive : ''}`}
              onClick={() => applyPreset(preset)}
              disabled={isGenerating}
            >
              <span className={styles.styleEmoji}>{preset.emoji}</span>
              <div className={styles.styleInfo}>
                <span className={styles.styleNameTh}>{preset.nameTh}</span>
                <span className={styles.styleName}>{preset.name}</span>
              </div>
              {isSelected && <span className={styles.selectedCheck}>✓</span>}
            </button>
          );
        })}
      </div>

      {/* Main Generate Button */}
      <div className={styles.actions}>
        <button
          className={styles.btnGenerate}
          onClick={() => generate()}
          disabled={isGenerating || (!capturedImage && !frameData)}
        >
          {isGenerating ? (
            <><span className={styles.spinner} />กำลังประมวลผล...</>
          ) : (
            '✨ แปลงสไตล์ภาพ (APPLY STYLE)'
          )}
        </button>
      </div>

      {!capturedImage && (
        <p className={styles.hint}>📸 ถ่ายรูปจากกล้องก่อน เพื่อเริ่มแปลงสไตล์ภาพ</p>
      )}

      {/* Collapsible Advanced Settings */}
      <div className={styles.advancedWrapper}>
        <button
          className={styles.btnAdvancedToggle}
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? '▼ ซ่อนตั้งค่าขั้นสูง (Hide Advanced)' : '▶ แสดงตั้งค่าขั้นสูง (Show Advanced)'}
        </button>

        {showAdvanced && (
          <div className={styles.advancedContent}>
            {/* ControlNet Mode */}
            <div className={styles.fieldFull}>
              <label className={styles.label}>CONTROLNET</label>
              <select 
                className={styles.select} 
                value={controlMode} 
                onChange={(e) => {
                  setControlMode(e.target.value);
                  setSelectedStyleId('');
                }}
              >
                {CONTROLNET_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Prompt */}
            <div className={styles.fieldFull}>
              <label className={styles.label}>PROMPT</label>
              <textarea
                className={styles.textarea}
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  setSelectedStyleId('');
                }}
                rows={3}
                placeholder="Describe what you want to generate..."
              />
            </div>

            {/* Negative Prompt */}
            <div className={styles.fieldFull}>
              <label className={styles.label}>NEGATIVE PROMPT</label>
              <textarea
                className={styles.textarea}
                value={negativePrompt}
                onChange={(e) => {
                  setNegativePrompt(e.target.value);
                  setSelectedStyleId('');
                }}
                rows={2}
                placeholder="What to avoid..."
              />
            </div>

            {/* Sliders */}
            <div className={styles.sliders}>
              <SliderField
                label="ControlNet Scale"
                value={controlScale}
                min={0} max={2} step={0.05}
                onChange={(v) => {
                  setControlScale(v);
                  setSelectedStyleId('');
                }}
                format={(v) => v.toFixed(2)}
              />
              <SliderField
                label="Steps"
                value={steps}
                min={5} max={50} step={1}
                onChange={(v) => {
                  setSteps(v);
                  setSelectedStyleId('');
                }}
                format={(v) => v.toString()}
              />
              <SliderField
                label="CFG Scale"
                value={guidanceScale}
                min={1} max={20} step={0.5}
                onChange={(v) => {
                  setGuidanceScale(v);
                  setSelectedStyleId('');
                }}
                format={(v) => v.toFixed(1)}
              />
            </div>

            {/* Seed & Live Mode */}
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>SEED (-1 = random)</label>
                <input
                  className={styles.input}
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(parseInt(e.target.value))}
                />
              </div>
              <div className={styles.field} style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  className={`${styles.btnLive} ${liveMode ? styles.liveActive : ''}`}
                  onClick={toggleLiveMode}
                  disabled={!capturedImage && !frameData}
                  style={{ width: '100%', height: '32px', fontSize: '11px' }}
                >
                  {liveMode ? '◉ LIVE ON' : '◎ LIVE'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Slider sub-component
function SliderField({
  label, value, min, max, step, onChange, format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div className={styles.sliderField}>
      <div className={styles.sliderHeader}>
        <span className={styles.label}>{label}</span>
        <span className={styles.sliderValue}>{format(value)}</span>
      </div>
      <input
        className={styles.slider}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}
