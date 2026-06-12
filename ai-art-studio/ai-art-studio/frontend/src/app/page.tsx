'use client';

import { useState } from 'react';
import CameraStream from '@/components/CameraStream';
import GeneratedCanvas from '@/components/GeneratedCanvas';
import ControlPanel from '@/components/ControlPanel';
import StatusBar from '@/components/StatusBar';
import styles from './page.module.css';

export default function Home() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  return (
    <main className={styles.main}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>◈</span>
          <span className={styles.logoText}>AI<em>ART</em>STUDIO</span>
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.badge}>ControlNet</span>
          <span className={styles.badge}>FLUX.1</span>
          <span className={styles.badge}>FastAPI</span>
        </div>
      </header>

      {/* Main workspace */}
      <div className={styles.workspace}>
        {/* Left: Camera + Controls */}
        <aside className={styles.sidebar}>
          <CameraStream />
          <ControlPanel
            isGenerating={isGenerating}
            setIsGenerating={setIsGenerating}
            setGeneratedImage={setGeneratedImage}
            setJobId={setJobId}
          />
        </aside>

        {/* Right: Output canvas */}
        <section className={styles.canvas}>
          <GeneratedCanvas
            generatedImage={generatedImage}
            isGenerating={isGenerating}
            jobId={jobId}
          />
        </section>
      </div>

      {/* Bottom: Status */}
      <StatusBar isGenerating={isGenerating} jobId={jobId} />
    </main>
  );
}
