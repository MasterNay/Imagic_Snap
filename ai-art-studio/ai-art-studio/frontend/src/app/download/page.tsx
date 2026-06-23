'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';

function DownloadPageContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get('job_id');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (!jobId) {
      setError('ไม่พบข้อมูลของภาพ (No Job ID)');
      setLoading(false);
      return;
    }

    const fetchJob = async () => {
      try {
        const res = await fetch(`${API_URL}/job/${jobId}`);
        if (!res.ok) throw new Error('ไม่พบข้อมูลการประมวลผลบนเซิร์ฟเวอร์');
        const data = await res.json();

        if (data.status === 'completed') {
          if (data.original_image) {
            setOriginalImage(`data:image/jpeg;base64,${data.original_image}`);
          }
          if (data.result_image) {
            setGeneratedImage(`data:image/png;base64,${data.result_image}`);
          }
          setLoading(false);
        } else if (data.status === 'failed') {
          setError('การประมวลผลล้มเหลว (Job failed)');
          setLoading(false);
        } else {
          // Still pending or running, poll again in 1.5 seconds
          setTimeout(fetchJob, 1500);
        }
      } catch (err: any) {
        setError(err.message || 'การเชื่อมต่อผิดพลาด');
        setLoading(false);
      }
    };

    fetchJob();
  }, [jobId, API_URL]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>กำลังดึงรูปภาพของคุณ...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>✕</div>
        <p className={styles.errorText}>{error}</p>
      </div>
    );
  }

  return (
    <div className={styles.content}>
      {/* Original Image Card */}
      {originalImage && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>ORIGINAL PHOTO / ภาพถ่ายต้นฉบับ</span>
          </div>
          <div className={styles.imageWrapper}>
            <img src={originalImage} alt="Original input" className={styles.image} />
          </div>
          <div className={styles.cardActions}>
            <a
              href={originalImage}
              download={`original-${jobId?.slice(0, 8)}.jpg`}
              className={styles.downloadBtn}
            >
              DOWNLOAD ORIGINAL PHOTO
            </a>
          </div>
        </div>
      )}

      {/* Generated Image Card */}
      {generatedImage && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>GENERATED ART / ภาพสไตล์ใหม่</span>
          </div>
          <div className={styles.imageWrapper}>
            <img src={generatedImage} alt="AI Generated Output" className={styles.image} />
          </div>
          <div className={styles.cardActions}>
            <a
              href={generatedImage}
              download={`ai-art-studio-${jobId?.slice(0, 8)}.png`}
              className={styles.downloadBtn}
            >
              DOWNLOAD IMAGE
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DownloadPage() {
  return (
    <main className={styles.main}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>◈</span>
          <span className={styles.logoText}>AI<em>ART</em>STUDIO</span>
        </div>
      </header>

      {/* Workspace */}
      <div className={styles.workspace}>
        <Suspense fallback={
          <div className={styles.loadingContainer}>
            <div className={styles.spinner} />
            <p>กำลังเตรียมโหลด...</p>
          </div>
        }>
          <DownloadPageContent />
        </Suspense>
      </div>
    </main>
  );
}
