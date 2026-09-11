'use client';

import React, { useState } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { BottomNav } from './bottom-nav';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function AppLayout({ children, title, description }: AppLayoutProps) {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

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
