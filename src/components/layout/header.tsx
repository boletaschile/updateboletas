'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PlusCircle, Bell, Search, User, Camera, LogOut, Building2, ChevronDown, LogIn, Menu } from 'lucide-react';
import { CameraCaptureModal } from '@/components/receipts/camera-capture-modal';
import { useAuth } from '@/lib/store/auth-context';

interface HeaderProps {
  title?: string;
  description?: string;
  onToggleMobileMenu?: () => void;
}

export function Header({ title, description, onToggleMobileMenu }: HeaderProps) {
  const router = useRouter();
  const { user, activeOrg, activeOrgId, logout } = useAuth();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="h-16 border-b bg-card/60 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Lado Izquierdo: Botón Hamburguesa Móvil + Título */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleMobileMenu}
          className="md:hidden h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
          title="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="min-w-0">
          {title && (
            <h1 className="text-sm sm:text-base md:text-lg font-bold text-foreground leading-tight truncate max-w-[160px] xs:max-w-[200px] sm:max-w-xs md:max-w-none">
              {title}
            </h1>
          )}
          {description && <p className="hidden md:block text-xs text-muted-foreground truncate">{description}</p>}
        </div>
      </div>

      {/* Lado Derecho: Acciones y Usuario */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Botón Tomar Foto (Cámara) */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsCameraOpen(true)}
          className="h-8 sm:h-9 px-2 sm:px-3 gap-1.5 text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-900"
          title="Tomar foto con la cámara"
        >
          <Camera className="h-4 w-4 text-blue-600" />
          <span className="hidden sm:inline">Cámara</span>
        </Button>

        {/* Botón Subir / Nueva Boleta */}
        <Link href="/receipts/new">
          <Button size="sm" className="h-8 sm:h-9 px-2 sm:px-3 gap-1.5 shadow-sm font-medium text-xs">
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Nueva Boleta</span>
          </Button>
        </Link>

        {/* Perfil de Usuario o Iniciar Sesión */}
        {user ? (
          <div className="relative pl-1.5 sm:pl-3 border-l border-border">
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
                    <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-medium">
                      {activeOrg?.name || 'Vista Consolidada'}
                    </span>
                  </div>

                  <Link
                    href="/settings/organizations"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted text-foreground transition-colors"
                  >
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>Mis Empresas</span>
                  </Link>

                  <Link
                    href="/settings"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted text-foreground transition-colors"
                  >
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Mi Perfil & Ajustes</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors text-left font-medium"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <Link href="/login">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Entrar</span>
            </Button>
          </Link>
        )}
      </div>

      {/* Modal de Cámara */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(file) => {
          setIsCameraOpen(false);
          router.push('/receipts/new');
        }}
      />
    </header>
  );
}
