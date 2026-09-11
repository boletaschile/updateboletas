'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PlusCircle, Bell, Search, User, Camera, LogOut, Building2, ChevronDown, LogIn } from 'lucide-react';
import { CameraCaptureModal } from '@/components/receipts/camera-capture-modal';
import { useAuth } from '@/lib/store/auth-context';

interface HeaderProps {
  title?: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  const router = useRouter();
  const { user, activeOrg, activeOrgId, logout } = useAuth();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="h-16 border-b bg-card/40 backdrop-blur-md px-4 md:px-6 flex items-center justify-between sticky top-0 z-30">
      <div>
        {title && <h1 className="text-base md:text-lg font-bold text-foreground leading-tight">{title}</h1>}
        {description && <p className="hidden sm:block text-xs text-muted-foreground">{description}</p>}
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* Botón Tomar Foto (Cámara Móvil) */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsCameraOpen(true)}
          className="gap-1.5 text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-900"
          title="Tomar foto con la cámara"
        >
          <Camera className="h-4 w-4 text-blue-600" />
          <span className="hidden sm:inline">Cámara</span>
        </Button>

        {/* Acciones Rápidas */}
        <Link href="/receipts/new">
          <Button size="sm" className="gap-1.5 shadow-sm font-medium text-xs">
            <PlusCircle className="h-4 w-4" />
            <span>Nueva Boleta</span>
          </Button>
        </Link>

        {/* Perfil de Usuario o Botón Iniciar Sesión */}
        {user ? (
          <div className="relative pl-2 md:pl-3 border-l border-border">
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-muted/60 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="hidden lg:block text-left text-xs">
                <span className="font-semibold block text-foreground leading-tight">
                  {user?.full_name || 'Usuario'}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {user?.email || 'contacto@empresa.cl'}
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden lg:block" />
            </button>

            {isUserMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border bg-card p-2 shadow-xl z-50 text-xs space-y-1">
                  <div className="p-2 border-b">
                    <p className="font-semibold text-foreground truncate">{user?.full_name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
                  </div>

                  <Link
                    href="/settings/organizations"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted text-foreground transition-colors"
                  >
                    <Building2 className="h-4 w-4 text-blue-600" />
                    <span>Mis Empresas y Equipo</span>
                  </Link>

                  <div className="h-px bg-border my-1" />

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 font-medium transition-colors text-left"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="pl-2 md:pl-3 border-l border-border">
            <Link href="/login">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <LogIn className="h-3.5 w-3.5 text-blue-600" />
                <span>Iniciar Sesión</span>
              </Button>
            </Link>
          </div>
        )}
      </div>

      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={() => router.push('/receipts/new')}
      />
    </header>
  );
}
