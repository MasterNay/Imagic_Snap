import { create } from 'zustand';

interface CameraState {
  frameData: string | null;
  isStreaming: boolean;
  setFrameData: (data: string | null) => void;
  setIsStreaming: (v: boolean) => void;
}

export const useCameraStore = create<CameraState>((set) => ({
  frameData: null,
  isStreaming: false,
  setFrameData: (frameData) => set({ frameData }),
  setIsStreaming: (isStreaming) => set({ isStreaming }),
}));
