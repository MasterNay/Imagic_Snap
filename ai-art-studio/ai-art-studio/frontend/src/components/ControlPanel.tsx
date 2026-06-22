'use client';

import { useState, useEffect } from 'react';
import { useCameraStore } from '@/store/cameraStore';
import styles from './ControlPanel.module.css';

interface Props {
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
  setGeneratedImage: (v: string | null) => void;
  setGeneratedImageUrl: (v: string | null) => void;
  setJobId: (v: string | null) => void;
}

interface StylePreset {
  id: string;
  name: string;
  nameTh: string;
  emoji: string;
  prompt: string;
}

const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'anime',
    name: 'Anime Art',
    nameTh: 'ลายเส้นอนิเมะ',
    emoji: '🌸',
    prompt: 'Transform the person in the input image into a beautiful anime art style illustration, Studio Ghibli style, clean line art, vibrant colors, detailed scenery in the background, preserving their pose and facial structure.',
  },
  {
    id: 'watercolor',
    name: 'Watercolor',
    nameTh: 'ภาพสีน้ำ',
    emoji: '🎨',
    prompt: 'An elegant watercolor painting of the person in the input image. Smooth brushstrokes, soft color palette, artistic paint splatters, warm clean lighting, and a paper texture background, preserving their pose and facial features.',
  },
  {
    id: 'comic',
    name: 'Retro Comic',
    nameTh: 'การ์ตูนคอมิกส์',
    emoji: '💥',
    prompt: 'A retro comic book pop art illustration of the person in the input image. Bold black ink outlines, clean solid colors, halftone dot pattern background, vintage comic style, preserving their pose and facial structure.',
  },
  {
    id: 'pencil',
    name: 'Pencil Art',
    nameTh: 'ภาพวาดดินสอ',
    emoji: '✏️',
    prompt: 'Convert to pencil sketch with natural graphite lines, cross-hatching, and visible paper texture. Preserve the person’s pose and facial structure, with detailed shading and a monochrome look.',
  },
  {
    id: 'cyberpunk_subtle',
    name: 'Cyberpunk',
    nameTh: 'ไซเบอร์พังก์',
    emoji: '🌆',
    prompt: 'A cyberpunk theme rendering of the person in the input image. Keep their pose and facial structure, but render them with glowing neon light reflections, futuristic clothing, and a dark wet street background with neon signs.',
  },
  {
    id: 'pixel',
    name: 'Pixel Art',
    nameTh: 'ภาพพิกเซล',
    emoji: '👾',
    prompt: 'A low-resolution 8-bit retro game sprite of the person in the input image. Extremely pixelated with a distinct large blocky pixel grid, limited vibrant 16-color palette, retro arcade aesthetic, heavy dithering patterns, crisp jagged aliased edges, strictly simplifying all features into pixel blocks while maintaining the exact pose and features from the original image without distortion.',
  }
];

export default function ControlPanel({ isGenerating, setIsGenerating, setGeneratedImage, setGeneratedImageUrl, setJobId }: Props) {
  const { capturedImage, frameData } = useCameraStore();

  const [selectedStyleId, setSelectedStyleId] = useState<string>('anime');
  const [prompt, setPrompt] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Apply selected style preset
  const applyPreset = (preset: StylePreset) => {
    setSelectedStyleId(preset.id);
    setPrompt(preset.prompt);
  };

  // Set default preset on mount
  useEffect(() => {
    const defaultPreset = STYLE_PRESETS.find((p) => p.id === 'anime');
    if (defaultPreset) applyPreset(defaultPreset);
  }, []);

  const generate = async () => {
    const frame = capturedImage ?? frameData;
    if (!frame) {
      alert('กรุณาเปิดกล้องและถ่ายรูปก่อนแปลงสไตล์ภาพครับ');
      return;
    }

    setIsGenerating(true);
    setJobId(null);
    setGeneratedImageUrl(null);

    try {
      const res = await fetch(`${API_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: frame.split(',')[1], // base64 without prefix
          prompt,
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
          setGeneratedImageUrl(data.result_url || null);
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

      {/* Custom Prompt Text Area */}
      <div className={styles.fieldFull} style={{ marginTop: '8px' }}>
        <label className={styles.label}>PROMPT / รายละเอียดคำสั่งภาพ</label>
        <textarea
          className={styles.textarea}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setSelectedStyleId(''); // Deselect preset since we customized
          }}
          rows={4}
          placeholder="Describe what you want to generate..."
          disabled={isGenerating}
        />
      </div>

      {/* Main Generate Button */}
      <div className={styles.actions}>
        <button
          className={styles.btnGenerate}
          onClick={generate}
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
    </div>
  );
}
