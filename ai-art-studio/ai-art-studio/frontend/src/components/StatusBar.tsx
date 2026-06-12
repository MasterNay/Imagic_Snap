'use client';

import { useEffect, useState } from 'react';
import styles from './StatusBar.module.css';

interface Props {
  isGenerating: boolean;
  jobId: string | null;
}

export default function StatusBar({ isGenerating, jobId }: Props) {
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [elapsed, setElapsed] = useState(0);

  // Check API health
  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const check = async () => {
      try {
        const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(3000) });
        setApiStatus(res.ok ? 'online' : 'offline');
      } catch {
        setApiStatus('offline');
      }
    };
    check();
    const iv = setInterval(check, 10000);
    return () => clearInterval(iv);
  }, []);

  // Timer during generation
  useEffect(() => {
    if (!isGenerating) { setElapsed(0); return; }
    const start = Date.now();
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 100);
    return () => clearInterval(iv);
  }, [isGenerating]);

  return (
    <footer className={styles.bar}>
      <div className={styles.left}>
        <div className={`${styles.statusDot} ${styles[apiStatus]}`} />
        <span className={styles.statusText}>API {apiStatus.toUpperCase()}</span>
      </div>

      <div className={styles.center}>
        {isGenerating && (
          <span className={styles.genStatus}>
            ⚡ GENERATING — {elapsed}s elapsed
            {jobId && ` · JOB ${jobId.slice(0, 8).toUpperCase()}`}
          </span>
        )}
      </div>

      <div className={styles.right}>
        <span className={styles.meta}>FLUX / SDXL + ControlNet</span>
        <span className={styles.meta}>·</span>
        <span className={styles.meta}>FastAPI Backend</span>
        <span className={styles.meta}>·</span>
        <span className={styles.meta}>Studio Mode</span>
      </div>
    </footer>
  );
}
