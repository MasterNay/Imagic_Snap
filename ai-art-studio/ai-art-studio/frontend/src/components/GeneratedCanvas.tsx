'use client';

import { useEffect, useState } from 'react';
import styles from './GeneratedCanvas.module.css';

interface Props {
  generatedImage: string | null;
  generatedImageUrl: string | null;
  isGenerating: boolean;
  jobId: string | null;
}

export default function GeneratedCanvas({ generatedImage, generatedImageUrl, isGenerating, jobId }: Props) {
  const [downloadPageUrl, setDownloadPageUrl] = useState('');
  const [progress, setProgress] = useState(0);

  // Generate the download page URL safely on the client side
  useEffect(() => {
    if (typeof window !== 'undefined' && jobId) {
      setDownloadPageUrl(`${window.location.origin}/download?job_id=${jobId}`);
    }
  }, [jobId]);

  // Fake progress animation during generation
  useEffect(() => {
    if (!isGenerating) {
      setProgress(0);
      return;
    }

    setProgress(5);
    const iv = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) { clearInterval(iv); return 90; }
        return p + Math.random() * 8;
      });
    }, 400);

    return () => clearInterval(iv);
  }, [isGenerating]);

  return (
    <div className={styles.wrapper}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>OUTPUT CANVAS</span>
        {jobId && (
          <span className={styles.jobId}>JOB {jobId.slice(0, 8).toUpperCase()}</span>
        )}
        {generatedImage && (
          <a
            className={styles.downloadBtn}
            href={generatedImage}
            download="ai-art-studio-output.png"
          >
            ↓ SAVE
          </a>
        )}
      </div>

      {/* Canvas area */}
      <div className={styles.canvas}>
        {/* Grid background */}
        <div className={styles.grid} />

        {/* Generated image */}
        {generatedImage && !isGenerating && (
          <img
            src={generatedImage}
            alt="AI Generated"
            className={styles.outputImage}
          />
        )}

        {/* QR Code Overlay for mobile download */}
        {downloadPageUrl && !isGenerating && (
          <div className={styles.qrOverlay}>
            <div className={styles.qrContainer}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(downloadPageUrl)}`}
                alt="Scan to Download"
                className={styles.qrImage}
              />
              <div className={styles.qrText}>
                <span>SCAN TO</span>
                <strong>DOWNLOAD</strong>
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isGenerating && (
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingInner}>
              <div className={styles.loadingRing} />
              <div className={styles.loadingText}>GENERATING</div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className={styles.progressLabel}>{Math.round(progress)}%</div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!generatedImage && !isGenerating && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>◈</div>
            <div className={styles.emptyTitle}>Awaiting Generation</div>
            <div className={styles.emptyDesc}>
              Start the camera, configure params,<br />then press GENERATE
            </div>
          </div>
        )}
      </div>

      {/* Metadata strip */}
      {generatedImage && (
        <div className={styles.metadata}>
          <span className={styles.metaItem}>512×512</span>
          <span className={styles.metaSep}>·</span>
          <span className={styles.metaItem}>PNG</span>
          <span className={styles.metaSep}>·</span>
          <span className={styles.metaItem}>COMPLETED</span>
        </div>
      )}
    </div>
  );
}
