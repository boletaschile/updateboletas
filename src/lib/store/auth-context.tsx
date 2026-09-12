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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string>('all');
  const [members, setMembers] = useState<Record<string, OrganizationMember[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Cargar de LocalStorage
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
        setOrganizations(JSON.parse(savedOrgs));
      } else {
        setOrganizations([]);
      }

      if (savedActiveOrg) setActiveOrgId(savedActiveOrg);
      if (savedMembers) setMembers(JSON.parse(savedMembers));
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
    await new Promise((r) => setTimeout(r, 400));
    const cleanEmail = email.trim().toLowerCase();
    const userId = `user-${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
    const namePart = cleanEmail.split('@')[0];
    const fullName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

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
          id: `org-personal-${Date.now()}`,
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
    setOrganizations([]);
    setActiveOrgId('all');
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_ORGS);
    localStorage.removeItem(STORAGE_KEY_ACTIVE_ORG);
    localStorage.removeItem(STORAGE_KEY_MEMBERS);
    window.location.href = '/login';
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
