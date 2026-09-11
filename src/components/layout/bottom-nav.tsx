'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Receipt, Plus, Clock, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReceipts } from '@/lib/store/receipts-context';
import { useAuth } from '@/lib/store/auth-context';

interface BottomNavProps {
  onOpenMenu: () => void;
}

export function BottomNav({ onOpenMenu }: BottomNavProps) {
  const pathname = usePathname();
  const { debts } = useReceipts();
  const { activeOrgId } = useAuth();

  const scopedDebts = debts.filter((d) => {
    if (activeOrgId !== 'all') {
      if (activeOrgId === 'org-personal') {
        if (d.expense_type !== 'personal' && d.organization_id !== 'org-personal') return false;
      } else {
        if (d.organization_id && d.organization_id !== activeOrgId) return false;
      }
    }
    return true;
  });

  const urgentDebtsCount = scopedDebts.filter((d) => d.status === 'overdue' || d.status === 'due_soon').length;

  const isHome = pathname === '/';
  const isReceipts = pathname.startsWith('/receipts') && pathname !== '/receipts/new';
  const isNew = pathname === '/receipts/new';
  const isDebts = pathname.startsWith('/cuentas-por-pagar');

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-lg border-t border-border/80 px-2 py-1 shadow-lg">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto relative">
        {/* 1. Dashboard */}
        <Link
          href="/"
          className={cn(
            'flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors',
            isHome ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <LayoutDashboard className="h-5 w-5 mb-0.5" />
          <span>Inicio</span>
        </Link>

        {/* 2. Mis Boletas */}
        <Link
          href="/receipts"
          className={cn(
            'flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors',
            isReceipts ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Receipt className="h-5 w-5 mb-0.5" />
          <span>Boletas</span>
        </Link>

        {/* 3. Botón Flotante Central (Subir / Cámara) */}
        <div className="flex items-center justify-center flex-1 -mt-5">
          <Link
            href="/receipts/new"
            className={cn(
              'h-13 w-13 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex flex-col items-center justify-center shadow-lg shadow-blue-500/30 border-2 border-background transition-transform active:scale-95',
              isNew && 'ring-2 ring-blue-500 ring-offset-2 ring-offset-background'
            )}
            title="Subir o sacar foto a boleta"
          >
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </Link>
        </div>

        {/* 4. Cuentas por Pagar */}
        <Link
          href="/cuentas-por-pagar"
          className={cn(
            'flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors relative',
            isDebts ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div className="relative">
            <Clock className="h-5 w-5 mb-0.5" />
            {urgentDebtsCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-rose-600 text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                {urgentDebtsCount}
              </span>
            )}
          </div>
          <span>Deudas</span>
        </Link>

        {/* 5. Menú Completo */}
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Menu className="h-5 w-5 mb-0.5" />
          <span>Menú</span>
        </button>
      </div>
    </div>
  );
}
