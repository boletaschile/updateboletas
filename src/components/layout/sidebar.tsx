'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Receipt,
  UploadCloud,
  PieChart,
  Tags,
  FileSpreadsheet,
  Settings,
  ShieldCheck,
  Building2,
  Users,
  BookOpen,
  Landmark,
  Clock,
} from 'lucide-react';
import { OrganizationSwitcher } from './organization-switcher';
import { useReceipts } from '@/lib/store/receipts-context';
import { useAuth } from '@/lib/store/auth-context';
import { cn } from '@/lib/utils';

export function Sidebar() {
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

  const navItems = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Nueva Boleta', href: '/receipts/new', icon: UploadCloud, badge: 'IA' },
    { label: 'Mis Boletas y Gastos', href: '/receipts', icon: Receipt },
    {
      label: 'Cuentas por Pagar',
      href: '/cuentas-por-pagar',
      icon: Clock,
      badge: urgentDebtsCount > 0 ? `${urgentDebtsCount}` : undefined,
      badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
    },
    { label: 'Conciliación Bancaria', href: '/conciliacion-bancaria', icon: Landmark, badge: 'Banco' },
    { label: 'Libro de Compras', href: '/libro-compras', icon: BookOpen, badge: 'F29' },
    { label: 'Presupuestos', href: '/budgets', icon: PieChart },
    { label: 'Categorías', href: '/categories', icon: Tags },
    { label: 'Informes & Excel', href: '/reports', icon: FileSpreadsheet },
    { label: 'Empresas y Equipo', href: '/settings/organizations', icon: Users },
    { label: 'Configuración', href: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 border-r bg-card/60 backdrop-blur-md flex flex-col justify-between h-screen sticky top-0">
      <div>
        {/* Logo & Brand */}
        <div className="h-16 border-b flex items-center px-6 gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight block text-foreground">
              Boletas<span className="text-blue-600">Chile</span>
            </span>
            <span className="text-[10px] text-muted-foreground font-medium block">
              Multiempresa & IA
            </span>
          </div>
        </div>

        {/* Selector de Empresa / Perfil */}
        <div className="p-3 border-b bg-muted/20">
          <OrganizationSwitcher />
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group',
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={cn(
                      'h-4 w-4 transition-transform group-hover:scale-110',
                      isActive ? 'text-white' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={cn(
                      'text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full',
                      isActive
                        ? 'bg-white/20 text-white'
                        : item.badgeColor ||
                          (item.badge === 'Banco'
                            ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300')
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / Account / Status */}
      <div className="p-4 border-t space-y-3">
        <div className="bg-muted/50 p-3 rounded-lg border border-border/50 text-xs">
          <div className="flex items-center gap-2 text-emerald-600 font-semibold mb-1">
            <ShieldCheck className="h-4 w-4" />
            <span>Vencimientos & Control</span>
          </div>
          <p className="text-muted-foreground text-[10px] leading-relaxed">
            Alertas automáticas de facturas por pagar y compromisos tributarios.
          </p>
        </div>
      </div>
    </aside>
  );
}
