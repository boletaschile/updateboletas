'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { BottomNav } from './bottom-nav';
import { useAuth } from '@/lib/store/auth-context';
import { Loader2 } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function AppLayout({ children, title, description }: AppLayoutProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-xs text-slate-400">Cargando sesión segura...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Barra Lateral Desktop & Drawer Móvil */}
      <Sidebar
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
      />

      {/* Contenedor Principal */}
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden">
        <Header
          title={title}
          description={description}
          onToggleMobileMenu={() => setIsMobileDrawerOpen((prev) => !prev)}
        />
        <main className="flex-1 p-3.5 sm:p-6 md:p-8 pb-24 md:pb-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Barra de Navegación Inferior Móvil (App Native Feel) */}
      <BottomNav onOpenMenu={() => setIsMobileDrawerOpen(true)} />
    </div>
  );
}
