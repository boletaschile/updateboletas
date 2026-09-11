'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile, Organization, OrganizationMember, UserRole } from '@/types';

interface AuthContextType {
  user: Profile | null;
  organizations: Organization[];
  activeOrgId: string; // 'all' o un id de organization
  activeOrg: Organization | null;
  members: Record<string, OrganizationMember[]>; // orgId -> members
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  register: (data: {
    email: string;
    fullName: string;
    accountType: 'personal' | 'business' | 'both';
    companyName?: string;
    companyRut?: string;
  }) => Promise<boolean>;
  logout: () => void;
  setActiveOrgId: (id: string) => void;
  createOrganization: (data: {
    name: string;
    rut?: string;
    legal_name?: string;
    type: 'business' | 'personal';
  }) => Organization;
  inviteMember: (orgId: string, email: string, role: UserRole) => void;
  removeMember: (orgId: string, memberId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_USER = 'subeboletas_auth_user_v1';
const STORAGE_KEY_ORGS = 'subeboletas_auth_orgs_v1';
const STORAGE_KEY_ACTIVE_ORG = 'subeboletas_auth_active_org_v1';
const STORAGE_KEY_MEMBERS = 'subeboletas_auth_members_v1';

const DEFAULT_USER: Profile = {
  id: 'user-demo-1',
  email: 'contacto@estudiocreativo.cl',
  full_name: 'Rodrigo Fuentes',
  avatar_url: null,
  preferred_currency: 'CLP',
  date_format: 'DD/MM/YYYY',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEFAULT_ORGS: Organization[] = [
  {
    id: 'org-personal',
    name: 'Finanzas Personales',
    rut: '16.789.123-4',
    legal_name: 'Rodrigo Fuentes',
    type: 'personal',
    created_by: 'user-demo-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    members_count: 1,
  },
  {
    id: 'org-empresa-1',
    name: 'Estudio Creativo SpA',
    rut: '76.890.123-4',
    legal_name: 'Estudio Creativo y Diseño SpA',
    activity: 'Servicios de publicidad, diseño e informática',
    type: 'business',
    created_by: 'user-demo-1',
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
    members_count: 3,
  },
  {
    id: 'org-empresa-2',
    name: 'Comercializadora Andina Ltda',
    rut: '77.456.789-K',
    legal_name: 'Comercializadora e Importadora Andina Limitada',
    activity: 'Venta de insumos y equipos',
    type: 'business',
    created_by: 'user-demo-1',
    created_at: '2026-03-10T00:00:00Z',
    updated_at: '2026-03-10T00:00:00Z',
    members_count: 2,
  },
];

const DEFAULT_MEMBERS: Record<string, OrganizationMember[]> = {
  'org-empresa-1': [
    {
      id: 'm-1',
      organization_id: 'org-empresa-1',
      user_id: 'user-demo-1',
      email: 'contacto@estudiocreativo.cl',
      full_name: 'Rodrigo Fuentes (Tú)',
      role: 'owner',
      created_at: '2026-01-15T00:00:00Z',
    },
    {
      id: 'm-2',
      organization_id: 'org-empresa-1',
      user_id: 'user-demo-2',
      email: 'contabilidad@estudiocreativo.cl',
      full_name: 'Camila Morales (Contadora)',
      role: 'admin',
      created_at: '2026-02-01T00:00:00Z',
    },
    {
      id: 'm-3',
      organization_id: 'org-empresa-1',
      user_id: 'user-demo-3',
      email: 'ventas@estudiocreativo.cl',
      full_name: 'Ignacio Silva',
      role: 'member',
      created_at: '2026-04-12T00:00:00Z',
    },
  ],
  'org-empresa-2': [
    {
      id: 'm-4',
      organization_id: 'org-empresa-2',
      user_id: 'user-demo-1',
      email: 'contacto@estudiocreativo.cl',
      full_name: 'Rodrigo Fuentes',
      role: 'owner',
      created_at: '2026-03-10T00:00:00Z',
    },
    {
      id: 'm-5',
      organization_id: 'org-empresa-2',
      user_id: 'user-demo-4',
      email: 'socio@andinachile.cl',
      full_name: 'Matías Valenzuela',
      role: 'admin',
      created_at: '2026-03-15T00:00:00Z',
    },
  ],
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(DEFAULT_USER);
  const [organizations, setOrganizations] = useState<Organization[]>(DEFAULT_ORGS);
  const [activeOrgId, setActiveOrgId] = useState<string>('all');
  const [members, setMembers] = useState<Record<string, OrganizationMember[]>>(DEFAULT_MEMBERS);
  const [isLoading, setIsLoading] = useState(false);

  // Cargar de LocalStorage
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEY_USER);
      const savedOrgs = localStorage.getItem(STORAGE_KEY_ORGS);
      const savedActiveOrg = localStorage.getItem(STORAGE_KEY_ACTIVE_ORG);
      const savedMembers = localStorage.getItem(STORAGE_KEY_MEMBERS);

      if (savedUser) setUser(JSON.parse(savedUser));
      if (savedOrgs) setOrganizations(JSON.parse(savedOrgs));
      if (savedActiveOrg) setActiveOrgId(savedActiveOrg);
      if (savedMembers) setMembers(JSON.parse(savedMembers));
    } catch (e) {
      console.warn('Error cargando estado de Auth:', e);
    }
  }, []);

  // Guardar en LocalStorage
  useEffect(() => {
    try {
      if (user) localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEY_ORGS, JSON.stringify(organizations));
      localStorage.setItem(STORAGE_KEY_ACTIVE_ORG, activeOrgId);
      localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(members));
    } catch (e) {
      console.warn('Error persistiendo estado de Auth:', e);
    }
  }, [user, organizations, activeOrgId, members]);

  const activeOrg = activeOrgId === 'all' ? null : organizations.find((o) => o.id === activeOrgId) || null;

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    const loggedUser: Profile = {
      id: `user-${Date.now()}`,
      email: email.trim().toLowerCase(),
      full_name: email.split('@')[0],
      avatar_url: null,
      preferred_currency: 'CLP',
      date_format: 'DD/MM/YYYY',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setUser(loggedUser);
    setIsLoading(false);
    return true;
  };

  const register = async (data: {
    email: string;
    fullName: string;
    accountType: 'personal' | 'business' | 'both';
    companyName?: string;
    companyRut?: string;
  }) => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 600));

    const newUserId = `user-${Date.now()}`;
    const newUser: Profile = {
      id: newUserId,
      email: data.email.trim().toLowerCase(),
      full_name: data.fullName.trim(),
      avatar_url: null,
      preferred_currency: 'CLP',
      date_format: 'DD/MM/YYYY',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const newOrgs: Organization[] = [
      {
        id: `org-personal-${Date.now()}`,
        name: 'Gastos Personales',
        rut: null,
        legal_name: data.fullName,
        type: 'personal',
        created_by: newUserId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        members_count: 1,
      },
    ];

    if (data.accountType === 'business' || data.accountType === 'both') {
      newOrgs.push({
        id: `org-biz-${Date.now()}`,
        name: data.companyName || 'Mi Empresa SpA',
        rut: data.companyRut || null,
        legal_name: data.companyName || 'Mi Empresa SpA',
        type: 'business',
        created_by: newUserId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        members_count: 1,
      });
    }

    setUser(newUser);
    setOrganizations(newOrgs);
    setActiveOrgId('all');
    setIsLoading(false);
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY_USER);
  };

  const createOrganization = (data: {
    name: string;
    rut?: string;
    legal_name?: string;
    type: 'business' | 'personal';
  }) => {
    const newOrg: Organization = {
      id: `org-${Date.now()}`,
      name: data.name.trim(),
      rut: data.rut?.trim() || null,
      legal_name: data.legal_name?.trim() || data.name.trim(),
      type: data.type,
      created_by: user?.id || 'user-demo-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      members_count: 1,
    };

    setOrganizations((prev) => [...prev, newOrg]);
    setActiveOrgId(newOrg.id);
    return newOrg;
  };

  const inviteMember = (orgId: string, email: string, role: UserRole) => {
    const newMember: OrganizationMember = {
      id: `m-${Date.now()}`,
      organization_id: orgId,
      user_id: `invited-${Date.now()}`,
      email: email.trim().toLowerCase(),
      full_name: email.split('@')[0],
      role: role,
      created_at: new Date().toISOString(),
    };

    setMembers((prev) => ({
      ...prev,
      [orgId]: [...(prev[orgId] || []), newMember],
    }));

    setOrganizations((prev) =>
      prev.map((o) => (o.id === orgId ? { ...o, members_count: (o.members_count || 1) + 1 } : o))
    );
  };

  const removeMember = (orgId: string, memberId: string) => {
    setMembers((prev) => ({
      ...prev,
      [orgId]: (prev[orgId] || []).filter((m) => m.id !== memberId),
    }));

    setOrganizations((prev) =>
      prev.map((o) => (o.id === orgId ? { ...o, members_count: Math.max(1, (o.members_count || 1) - 1) } : o))
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organizations,
        activeOrgId,
        activeOrg,
        members,
        isLoading,
        login,
        register,
        logout,
        setActiveOrgId,
        createOrganization,
        inviteMember,
        removeMember,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de un AuthProvider');
  }
  return context;
}
