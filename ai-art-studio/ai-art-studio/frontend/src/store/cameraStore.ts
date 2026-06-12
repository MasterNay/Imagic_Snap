import { create } from 'zustand';

interface CameraState {
  frameData: string | null;
  isStreaming: boolean;
  capturedImage: string | null;
  isCaptured: boolean;
  setFrameData: (data: string | null) => void;
  setIsStreaming: (v: boolean) => void;
  setCapturedImage: (data: string | null) => void;
  setIsCaptured: (v: boolean) => void;
}

export const useCameraStore = create<CameraState>((set) => ({
  frameData: null,
  isStreaming: false,
  capturedImage: null,
  isCaptured: false,
  setFrameData: (frameData) => set({ frameData }),
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  setCapturedImage: (capturedImage) => set({ capturedImage }),
  setIsCaptured: (isCaptured) => set({ isCaptured }),
}));
