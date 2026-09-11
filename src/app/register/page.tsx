'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/store/auth-context';
import { validateRUT, formatRUT } from '@/lib/utils';
import { Receipt, Mail, Lock, User, Building2, ArrowRight, Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function RegisterPage() {
  const { register, isLoading } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<'business' | 'personal' | 'both'>('both');
  const [companyName, setCompanyName] = useState('');
  const [companyRut, setCompanyRut] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const isRutValid = companyRut ? validateRUT(companyRut) : true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!email.trim() || !fullName.trim()) return;

    if (companyRut && !validateRUT(companyRut)) {
      setErrorMessage('El RUT de la empresa ingresado no es válido.');
      return;
    }

    try {
      setIsSuccess(true);
      await register({
        email,
        fullName,
        accountType,
        companyName: companyName || undefined,
        companyRut: companyRut ? formatRUT(companyRut) : undefined,
      });
      window.location.href = '/';
    } catch (err: any) {
      setIsSuccess(false);
      setErrorMessage('Ocurrió un inconveniente al registrar la cuenta.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 text-white">
      <div className="w-full max-w-lg space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20 mx-auto">
            <Receipt className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Crear Cuenta en Boletas<span className="text-blue-500">Chile</span>
          </h1>
          <p className="text-xs text-slate-400">
            Regístrate para gestionar gastos personales y múltiples empresas con IA
          </p>
        </div>

        {/* Formulario */}
        <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg text-white">Registro de Usuario</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Configura tu cuenta y tu primera entidad o empresa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Tipo de Cuenta */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">¿Cómo usarás el sistema?</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAccountType('both')}
                    className={`p-2.5 rounded-lg border text-center transition-all ${
                      accountType === 'both'
                        ? 'border-blue-500 bg-blue-950/60 text-blue-200 font-semibold'
                        : 'border-slate-800 hover:bg-slate-800/50 text-slate-400'
                    }`}
                  >
                    <span className="block text-xs">Ambos (Recomendado)</span>
                    <span className="text-[10px] text-slate-400">Empresa + Personal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccountType('business')}
                    className={`p-2.5 rounded-lg border text-center transition-all ${
                      accountType === 'business'
                        ? 'border-blue-500 bg-blue-950/60 text-blue-200 font-semibold'
                        : 'border-slate-800 hover:bg-slate-800/50 text-slate-400'
                    }`}
                  >
                    <span className="block text-xs">Solo Empresa</span>
                    <span className="text-[10px] text-slate-400">SpA / Ltda</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccountType('personal')}
                    className={`p-2.5 rounded-lg border text-center transition-all ${
                      accountType === 'personal'
                        ? 'border-emerald-500 bg-emerald-950/60 text-emerald-200 font-semibold'
                        : 'border-slate-800 hover:bg-slate-800/50 text-slate-400'
                    }`}
                  >
                    <span className="block text-xs">Solo Persona</span>
                    <span className="text-[10px] text-slate-400">Gastos propios</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Nombre Completo</Label>
                  <div className="relative">
                    <User className="h-4 w-4 absolute left-3 top-3 text-slate-500" />
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ej: Rodrigo Fuentes"
                      required
                      className="pl-9 bg-slate-950 border-slate-800 text-white text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Correo Electrónico</Label>
                  <div className="relative">
                    <Mail className="h-4 w-4 absolute left-3 top-3 text-slate-500" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu.correo@empresa.cl"
                      required
                      className="pl-9 bg-slate-950 border-slate-800 text-white text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Contraseña Segura</Label>
                <div className="relative">
                  <Lock className="h-4 w-4 absolute left-3 top-3 text-slate-500" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    className="pl-9 bg-slate-950 border-slate-800 text-white text-xs"
                  />
                </div>
              </div>

              {/* Datos de la Empresa si aplica */}
              {(accountType === 'business' || accountType === 'both') && (
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 font-semibold text-blue-400">
                    <Building2 className="h-4 w-4" />
                    <span>Tu Primera Empresa (Opcional - Puedes agregar más luego)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-300">Nombre de la Empresa</Label>
                      <Input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Ej: Mi Empresa SpA"
                        className="bg-slate-900 border-slate-800 text-white text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-300">RUT de la Empresa</Label>
                      <Input
                        value={companyRut}
                        onChange={(e) => setCompanyRut(e.target.value)}
                        onBlur={(e) => setCompanyRut(formatRUT(e.target.value))}
                        placeholder="76.123.456-7"
                        className={`bg-slate-900 border-slate-800 text-white text-xs ${
                          companyRut && !isRutValid ? 'border-red-500' : ''
                        }`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {errorMessage && (
                <p className="text-xs text-red-400 bg-red-950/40 p-2.5 rounded-lg border border-red-900/50">
                  {errorMessage}
                </p>
              )}

              <Button
                type="submit"
                disabled={isLoading || isSuccess}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-10 gap-2 shadow-md active:scale-95 transition-all"
              >
                {isLoading || isSuccess ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creando cuenta e ingresando...</span>
                  </>
                ) : (
                  <>
                    <span>Crear Cuenta y Empezar</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="bg-slate-950/60 border-t border-slate-800/80 p-4 flex items-center justify-center text-xs text-slate-400">
            <span>¿Ya tienes una cuenta? </span>
            <Link href="/login" className="text-blue-400 font-semibold hover:underline ml-1">
              Inicia sesión aquí
            </Link>
          </CardFooter>
        </Card>

        {/* Seguridad */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Aislamiento de datos con Row Level Security (RLS)</span>
        </div>
      </div>
    </div>
  );
}
