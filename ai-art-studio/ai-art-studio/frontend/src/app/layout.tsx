import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Art Studio — ControlNet + SDXL',
  description: 'Real-time AI image generation with ControlNet and Stable Diffusion XL',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
