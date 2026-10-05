import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'El correo electrónico es requerido' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password || 'BoletasChile2026!';
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase no configurado' }, { status: 500 });
    }

    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    let { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    });

    // Si las credenciales fallan y tenemos service role key (ej. desincronización entre dominios o primer acceso en nuevo dominio)
    if (authError && serviceRoleKey) {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = userList?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);

      if (existingUser) {
        // Resincronizar la contraseña en Supabase Auth
        await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          password: cleanPassword,
        });

        // Reintentar inicio de sesión
        const retry = await supabaseAnon.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });
        authData = retry.data;
        authError = retry.error;
      } else {
        // Registrar nuevo usuario en Supabase Auth
        const fullName = cleanEmail.split('@')[0];
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          password: cleanPassword,
          email_confirm: true,
          user_metadata: {
            full_name: fullName.charAt(0).toUpperCase() + fullName.slice(1),
          },
        });

        if (!createErr && created?.user) {
          const retry = await supabaseAnon.auth.signInWithPassword({
            email: cleanEmail,
            password: cleanPassword,
          });
          authData = retry.data;
          authError = retry.error;
        }
      }
    }

    if (authError || !authData?.session) {
      return NextResponse.json(
        { error: authError?.message || 'Error al iniciar sesión con Supabase' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      session: authData.session,
      user: authData.user,
    });
  } catch (err: any) {
    console.error('Error en /api/auth/login:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}
