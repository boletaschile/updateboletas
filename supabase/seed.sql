-- ==============================================================================
-- SEMILLA DE CATEGORÍAS INICIALES (EMPRESARIALES Y PERSONALES - CHILE)
-- ==============================================================================

-- Categorías de Empresa
INSERT INTO public.categories (name, type, icon, color, is_system) VALUES
('Hosting y dominios', 'business', 'Server', '#3B82F6', TRUE),
('Software y suscripciones', 'business', 'Code2', '#6366F1', TRUE),
('Publicidad y marketing', 'business', 'Megaphone', '#EC4899', TRUE),
('Equipos tecnológicos', 'business', 'Laptop', '#8B5CF6', TRUE),
('Insumos de oficina', 'business', 'Paperclip', '#10B981', TRUE),
('Insumos de producción', 'business', 'Boxes', '#F59E0B', TRUE),
('Servicios profesionales', 'business', 'Briefcase', '#14B8A6', TRUE),
('Telefonía e internet', 'business', 'Wifi', '#06B6D4', TRUE),
('Transporte y combustible', 'business', 'Fuel', '#EF4444', TRUE),
('Alimentación laboral', 'business', 'Utensils', '#F97316', TRUE),
('Comisiones bancarias', 'business', 'Landmark', '#64748B', TRUE),
('Impuestos', 'business', 'FileSpreadsheet', '#DC2626', TRUE),
('Mantención y reparaciones', 'business', 'Wrench', '#78716C', TRUE),
('Capacitación', 'business', 'GraduationCap', '#84CC16', TRUE),
('Otros gastos empresariales', 'business', 'HelpCircle', '#94A3B8', TRUE)
ON CONFLICT DO NOTHING;

-- Categorías Personales
INSERT INTO public.categories (name, type, icon, color, is_system) VALUES
('Supermercado', 'personal', 'ShoppingCart', '#10B981', TRUE),
('Vivienda', 'personal', 'Home', '#3B82F6', TRUE),
('Servicios básicos', 'personal', 'Zap', '#F59E0B', TRUE),
('Salud', 'personal', 'HeartPulse', '#EF4444', TRUE),
('Educación', 'personal', 'BookOpen', '#8B5CF6', TRUE),
('Transporte', 'personal', 'Car', '#06B6D4', TRUE),
('Alimentación', 'personal', 'UtensilsCrossed', '#F97316', TRUE),
('Vestuario', 'personal', 'Shirt', '#EC4899', TRUE),
('Entretención', 'personal', 'Film', '#A855F7', TRUE),
('Deudas', 'personal', 'CreditCard', '#DC2626', TRUE),
('Mascotas', 'personal', 'Dog', '#D97706', TRUE),
('Otros gastos personales', 'personal', 'MoreHorizontal', '#94A3B8', TRUE)
ON CONFLICT DO NOTHING;
