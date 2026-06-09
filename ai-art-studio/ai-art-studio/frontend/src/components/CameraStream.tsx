'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useCameraStore } from '@/store/cameraStore';
import styles from './CameraStream.module.css';

export default function CameraStream() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');

  const { setFrameData, setIsStreaming } = useCameraStore();

  // List camera devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devs) => {
      const cams = devs.filter((d) => d.kind === 'videoinput');
      setDevices(cams);
      if (cams.length > 0) setSelectedDevice(cams[0].deviceId);
    });
  }, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 512;
    canvas.height = 512;

    // Center-crop to square
    const size = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 512, 512);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setFrameData(dataUrl);
  }, [setFrameData]);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setCameraActive(true);
      setIsStreaming(true);

      // Capture frame every 200ms (5fps for the control signal)
      intervalRef.current = setInterval(captureFrame, 200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera access denied';
      setError(msg);
    }
  }, [selectedDevice, captureFrame, setIsStreaming]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCameraActive(false);
    setIsStreaming(false);
    setFrameData(null);
  }, [setIsStreaming, setFrameData]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className={styles.container}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>INPUT STREAM</span>
        <div className={`${styles.indicator} ${cameraActive ? styles.active : ''}`}>
          <span className={styles.dot} />
          {cameraActive ? 'LIVE' : 'IDLE'}
        </div>
      </div>

      {/* Video preview */}
      <div className={styles.videoWrapper}>
        <video
          ref={videoRef}
          className={styles.video}
          muted
          playsInline
          style={{ display: cameraActive ? 'block' : 'none' }}
        />
        {!cameraActive && (
          <div className={styles.placeholder}>
            <span className={styles.placeholderIcon}>⬡</span>
            <span>Camera offline</span>
          </div>
        )}
        {/* Corner decorations */}
        <div className={`${styles.corner} ${styles.tl}`} />
        <div className={`${styles.corner} ${styles.tr}`} />
        <div className={`${styles.corner} ${styles.bl}`} />
        <div className={`${styles.corner} ${styles.br}`} />
      </div>

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Device selector */}
      {devices.length > 1 && (
        <div className={styles.deviceRow}>
          <label className={styles.label}>DEVICE</label>
          <select
            className={styles.select}
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            disabled={cameraActive}
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Error */}
      {error && <div className={styles.error}>{error}</div>}

      {/* Controls */}
      <div className={styles.controls}>
        {!cameraActive ? (
          <button className={styles.btnStart} onClick={startCamera}>
            ▶ START CAMERA
          </button>
        ) : (
          <button className={styles.btnStop} onClick={stopCamera}>
            ■ STOP CAMERA
          </button>
        )}
      </div>
    </div>
  );
}
