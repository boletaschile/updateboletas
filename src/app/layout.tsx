import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/store/auth-context';
import { ReceiptsProvider } from '@/lib/store/receipts-context';

export const metadata: Metadata = {
  title: 'BoletasChile - Sistema Multiempresa Inteligente de Boletas y Gastos',
  description:
    'Registro y análisis automatizado de gastos con OCR e Inteligencia Artificial adaptado a boletas de Chile con soporte multiempresa y personal.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-screen bg-background font-sans antialiased">
        <AuthProvider>
          <ReceiptsProvider>{children}</ReceiptsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
