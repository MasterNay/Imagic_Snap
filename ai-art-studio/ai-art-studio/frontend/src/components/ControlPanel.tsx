'use client';

import { useState } from 'react';
import { useCameraStore } from '@/store/cameraStore';
import styles from './ControlPanel.module.css';

interface Props {
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
  setGeneratedImage: (v: string | null) => void;
  setJobId: (v: string | null) => void;
}

const CONTROLNET_MODES = [
  { value: 'canny', label: 'Canny Edge' },
  { value: 'depth', label: 'Depth Map' },
  { value: 'pose', label: 'OpenPose' },
  { value: 'hed', label: 'HED Softedge' },
  { value: 'normal', label: 'Normal Map' },
];

const MODELS = [
  { value: 'sdxl', label: 'SDXL 1.0' },
  { value: 'sd15', label: 'SD 1.5' },
];

export default function ControlPanel({ isGenerating, setIsGenerating, setGeneratedImage, setJobId }: Props) {
  const { frameData } = useCameraStore();

  const [prompt, setPrompt] = useState('cinematic portrait, dramatic lighting, ultra detailed, 8k');
  const [negativePrompt, setNegativePrompt] = useState('blurry, low quality, distorted, ugly');
  const [controlMode, setControlMode] = useState('canny');
  const [model, setModel] = useState('sdxl');
  const [controlScale, setControlScale] = useState(0.8);
  const [steps, setSteps] = useState(20);
  const [guidanceScale, setGuidanceScale] = useState(7.5);
  const [seed, setSeed] = useState(-1);
  const [liveMode, setLiveMode] = useState(false);
  const [liveInterval, setLiveIntervalRef] = useState<NodeJS.Timeout | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const generate = async (frameOverride?: string | null) => {
    const frame = frameOverride ?? frameData;
    if (!frame) {
      alert('No camera frame — start the camera first');
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

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json();
      setJobId(data.job_id);

      // Poll for result
      await pollJob(data.job_id);
    } catch (err) {
      console.error('Generation failed:', err);
      setIsGenerating(false);
    }
  };

  const pollJob = async (jobId: string) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
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
      // Stop
      if (liveInterval) clearInterval(liveInterval);
      setLiveIntervalRef(null);
      setLiveMode(false);
    } else {
      // Start
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
        <span className={styles.sectionTitle}>GENERATION PARAMS</span>
      </div>

      {/* Model & ControlNet Mode */}
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>MODEL</label>
          <select className={styles.select} value={model} onChange={(e) => setModel(e.target.value)}>
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>CONTROLNET</label>
          <select className={styles.select} value={controlMode} onChange={(e) => setControlMode(e.target.value)}>
            {CONTROLNET_MODES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Prompt */}
      <div className={styles.fieldFull}>
        <label className={styles.label}>PROMPT</label>
        <textarea
          className={styles.textarea}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
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
          onChange={(e) => setNegativePrompt(e.target.value)}
          rows={2}
          placeholder="What to avoid..."
        />
      </div>

      {/* Sliders */}
      <div className={styles.sliders}>
        <SliderField
          label="ControlNet Scale"
          value={controlScale}
          min={0} max={1} step={0.05}
          onChange={setControlScale}
          format={(v) => v.toFixed(2)}
        />
        <SliderField
          label="Steps"
          value={steps}
          min={10} max={50} step={1}
          onChange={setSteps}
          format={(v) => v.toString()}
        />
        <SliderField
          label="CFG Scale"
          value={guidanceScale}
          min={1} max={20} step={0.5}
          onChange={setGuidanceScale}
          format={(v) => v.toFixed(1)}
        />
      </div>

      {/* Seed */}
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
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button
          className={styles.btnGenerate}
          onClick={() => generate()}
          disabled={isGenerating || !frameData}
        >
          {isGenerating ? (
            <><span className={styles.spinner} /> GENERATING...</>
          ) : (
            '⚡ GENERATE'
          )}
        </button>
        <button
          className={`${styles.btnLive} ${liveMode ? styles.liveActive : ''}`}
          onClick={toggleLiveMode}
          disabled={!frameData}
        >
          {liveMode ? '◉ LIVE ON' : '◎ LIVE'}
        </button>
      </div>

      {!frameData && (
        <p className={styles.hint}>← Start camera to enable generation</p>
      )}
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
