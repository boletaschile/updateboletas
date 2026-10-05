'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile, Organization, OrganizationMember, UserRole, MonthlyFixedExpenses } from '@/types';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { ensureUUID } from '@/lib/supabase/db-service';

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
    password?: string;
  }) => Promise<boolean>;
  logout: () => void;
  setActiveOrgId: (id: string) => void;
  createOrganization: (data: {
    name: string;
    rut?: string;
    legal_name?: string;
    type: 'business' | 'personal';
    assigned_salary?: number | null;
    monthly_expenses?: MonthlyFixedExpenses | null;
  }) => Organization;
  updateOrganization: (
    id: string,
    data: {
      name: string;
      rut?: string | null;
      legal_name?: string | null;
      type?: 'business' | 'personal';
      assigned_salary?: number | null;
      monthly_expenses?: MonthlyFixedExpenses | null;
    }
  ) => void;
  deleteOrganization: (id: string) => boolean;
  inviteMember: (orgId: string, email: string, role: UserRole) => void;
  removeMember: (orgId: string, memberId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_USER = 'subeboletas_auth_user_v1';
const STORAGE_KEY_ORGS = 'subeboletas_auth_orgs_v1';
const STORAGE_KEY_ACTIVE_ORG = 'subeboletas_auth_active_org_v1';
const STORAGE_KEY_MEMBERS = 'subeboletas_auth_members_v1';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string>('all');
  const [members, setMembers] = useState<Record<string, OrganizationMember[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Cargar de LocalStorage y sincronizar con Supabase Auth
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEY_USER);
      const savedOrgs = localStorage.getItem(STORAGE_KEY_ORGS);
      const savedActiveOrg = localStorage.getItem(STORAGE_KEY_ACTIVE_ORG);
      const savedMembers = localStorage.getItem(STORAGE_KEY_MEMBERS);

      if (savedUser) {
        setUser(JSON.parse(savedUser));
      } else {
        setUser(null);
      }

      if (savedOrgs) {
        const parsedOrgs: Organization[] = JSON.parse(savedOrgs);
        setOrganizations(parsedOrgs);
        if (savedActiveOrg && savedActiveOrg !== 'all' && parsedOrgs.some((o) => o.id === savedActiveOrg)) {
          setActiveOrgId(savedActiveOrg);
        } else if (parsedOrgs.length > 0) {
          const defaultBiz = parsedOrgs.find((o) => o.type === 'business');
          setActiveOrgId(defaultBiz ? defaultBiz.id : parsedOrgs[0].id);
        }
      } else {
        setOrganizations([]);
      }

      if (savedMembers) setMembers(JSON.parse(savedMembers));

      // Sincronizar usuario activo de Supabase si está disponible
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseBrowserClient();
        supabase.auth.getUser().then(({ data: { user: supaUser } }) => {
          if (supaUser) {
            const userProfile: Profile = {
              id: supaUser.id,
              email: supaUser.email || '',
              full_name: (supaUser.user_metadata?.full_name as string) || supaUser.email?.split('@')[0] || 'Usuario',
              avatar_url: null,
              preferred_currency: 'CLP',
              date_format: 'DD/MM/YYYY',
              created_at: supaUser.created_at,
              updated_at: supaUser.updated_at || supaUser.created_at,
            };
            setUser(userProfile);
          }
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('Error cargando estado de Auth:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Guardar en LocalStorage
  useEffect(() => {
    if (isLoading) return;
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEY_USER);
      }
      localStorage.setItem(STORAGE_KEY_ORGS, JSON.stringify(organizations));
      localStorage.setItem(STORAGE_KEY_ACTIVE_ORG, activeOrgId);
      localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(members));
    } catch (e) {
      console.warn('Error persistiendo estado de Auth:', e);
    }
  }, [user, organizations, activeOrgId, members, isLoading]);

  const activeOrg = activeOrgId === 'all' ? null : organizations.find((o) => o.id === activeOrgId) || null;

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    let userId = ensureUUID();
    const namePart = cleanEmail.split('@')[0];
    const fullName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password || 'BoletasChile2026!',
        });

        if (authData?.user) {
          userId = authData.user.id;
        } else if (authError && (authError.message.toLowerCase().includes('invalid') || authError.message.toLowerCase().includes('credentials') || authError.message.toLowerCase().includes('not found'))) {
          // Si no existe, registrar automáticamente en Supabase Auth
          const { data: signUpData } = await supabase.auth.signUp({
            email: cleanEmail,
            password: password || 'BoletasChile2026!',
            options: {
              data: { full_name: fullName },
            },
          });
          if (signUpData?.user) {
            userId = signUpData.user.id;
          }
        }
      } catch (err) {
        console.warn('Supabase auth login error:', err);
      }
    }

    const loggedUser: Profile = {
      id: userId,
      email: cleanEmail,
      full_name: fullName,
      avatar_url: null,
      preferred_currency: 'CLP',
      date_format: 'DD/MM/YYYY',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setUser(loggedUser);
    setOrganizations((prev) => {
      if (prev.length > 0) return prev;
      return [
        {
          id: ensureUUID(),
          name: 'Finanzas Personales',
          rut: null,
          legal_name: fullName,
          type: 'personal',
          created_by: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          members_count: 1,
        },
      ];
    });
    setIsLoading(false);
    return true;
  };

  const register = async (data: {
    email: string;
    fullName: string;
    accountType: 'personal' | 'business' | 'both';
    companyName?: string;
    companyRut?: string;
    password?: string;
  }) => {
    setIsLoading(true);
    const cleanEmail = data.email.trim().toLowerCase();
    let newUserId = ensureUUID();

    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: signUpData } = await supabase.auth.signUp({
          email: cleanEmail,
          password: data.password || 'BoletasChile2026!',
          options: {
            data: { full_name: data.fullName.trim() },
          },
        });
        if (signUpData?.user) {
          newUserId = signUpData.user.id;
        }
      } catch (err) {
        console.warn('Supabase auth register error:', err);
      }
    }

    const newUser: Profile = {
      id: newUserId,
      email: cleanEmail,
      full_name: data.fullName.trim(),
      avatar_url: null,
      preferred_currency: 'CLP',
      date_format: 'DD/MM/YYYY',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const newOrgs: Organization[] = [
      {
        id: ensureUUID(),
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
        id: ensureUUID(),
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
    setOrganizations([]);
    setActiveOrgId('all');
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_ORGS);
    localStorage.removeItem(STORAGE_KEY_ACTIVE_ORG);
    localStorage.removeItem(STORAGE_KEY_MEMBERS);
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseBrowserClient();
        supabase.auth.signOut().catch(() => {});
      } catch (e) {}
    }
    window.location.href = '/login';
  };

  const createOrganization = (data: {
    name: string;
    rut?: string;
    legal_name?: string;
    type: 'business' | 'personal';
    assigned_salary?: number | null;
    monthly_expenses?: MonthlyFixedExpenses | null;
  }) => {
    const newOrg: Organization = {
      id: ensureUUID(),
      name: data.name.trim(),
      rut: data.rut?.trim() || null,
      legal_name: data.legal_name?.trim() || data.name.trim(),
      type: data.type,
      assigned_salary: data.assigned_salary ?? null,
      monthly_expenses: data.monthly_expenses ?? null,
      created_by: user?.id || ensureUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      members_count: 1,
    };

    setOrganizations((prev) => [...prev, newOrg]);
    setActiveOrgId(newOrg.id);
    return newOrg;
  };

  const updateOrganization = (
    id: string,
    data: {
      name: string;
      rut?: string | null;
      legal_name?: string | null;
      type?: 'business' | 'personal';
      assigned_salary?: number | null;
      monthly_expenses?: MonthlyFixedExpenses | null;
    }
  ) => {
    setOrganizations((prev) =>
      prev.map((org) => {
        if (org.id !== id) return org;
        return {
          ...org,
          name: data.name.trim(),
          rut: data.rut !== undefined ? (data.rut ? data.rut.trim() : null) : org.rut,
          legal_name:
            data.legal_name !== undefined
              ? (data.legal_name ? data.legal_name.trim() : data.name.trim())
              : org.legal_name,
          type: data.type || org.type,
          assigned_salary: data.assigned_salary !== undefined ? data.assigned_salary : org.assigned_salary,
          monthly_expenses: data.monthly_expenses !== undefined ? data.monthly_expenses : org.monthly_expenses,
          updated_at: new Date().toISOString(),
        };
      })
    );
  };

  const deleteOrganization = (id: string): boolean => {
    if (organizations.length <= 1) return false;
    setOrganizations((prev) => prev.filter((o) => o.id !== id));
    if (activeOrgId === id) {
      const remaining = organizations.filter((o) => o.id !== id);
      setActiveOrgId(remaining[0]?.id || 'all');
    }
    return true;
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
        updateOrganization,
        deleteOrganization,
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
