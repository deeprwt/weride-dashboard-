import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WeRide — Admin',
  description: 'WeRide operations console.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
