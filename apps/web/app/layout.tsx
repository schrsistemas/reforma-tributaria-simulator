import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reforma Tributária Simulator',
  description: 'Simulação versionada de IBS, CBS e Split Payment'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
