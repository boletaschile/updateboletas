# BoletasChile - Sistema de Gestión de Gastos, Boletas y Facturas con IA

Sistema web moderno desarrollado con **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS** y **Supabase** para la digitalización, extracción por OCR/IA, conciliación bancaria y contabilidad tributaria en **Chile (CLP, RUT Módulo 11, IVA 19%, F29)**.

---

## Características Principales

- **Digitalización Inteligente**:
  - Carga de imágenes (JPG, PNG, WebP) y documentos PDF.
  - Modo cámara web y smartphone integrado (`environment camera`).
  - Extracción automática de comercio, RUT, fecha, montos, desglose de ítems e impuestos con IA y OCR.
  - Detección de duplicados y validación estricta de RUT chileno (Módulo 11).

- **Multiempresa & Personal**:
  - Switcher reactivo para alternar entre "Finanzas Personales" y múltiples empresas (SpA, Ltda).
  - Aislamiento y cálculo de métricas financieras deducibles vs. personales.

- **Libro de Compras Oficial (Registro RCV - SII)**:
  - Clasificación según tipos de documento SII (Código 33: Factura Electrónica, Código 39: Boleta, etc.).
  - Cálculo automático de Crédito Fiscal IVA (19%) para declaración mensual **F29**.
  - Exportación a **Excel (.xlsx multi-hoja)** y **CSV**.

- **Conciliación Bancaria Automática**:
  - Carga de cartolas bancarias (Banco de Chile, Santander, BCI, etc.).
  - Algoritmo inteligente de coincidencia por monto, fecha y descripción comercial.
  - Registro de gastos rápidos en 1 clic para cargos no respaldados.

- **Cuentas por Pagar & Vencimientos**:
  - Control de facturas a crédito, cuotas bancarias, arriendos, Previred e impuestos F29.
  - Alertas preventivas configurables (3 a 7 días antes) y cálculo en vivo de días restantes.
  - Marcado de pago en 1 clic y exportación de programación a Excel.

- **Presupuestos y Reportes**:
  - Umbrales de alerta temprana al 75%, 90% y 100%.
  - Gráficos comparativos mensuales y distribución por categoría (Recharts).

---

## Tecnologías Utilizadas

- **Frontend**: Next.js 14 (React 18), TypeScript, Tailwind CSS, Lucide Icons, Recharts.
- **Backend / Database**: Supabase (PostgreSQL, Row Level Security, Auth, Storage).
- **IA & OCR**: Tesseract.js / OpenAI Vision API para lectura y parsing estructurado.
- **Exportación**: SheetJS (XLSX) con formateo monetario chileno ($ CLP).
- **Pruebas**: Vitest.

---

## Instalación y Puesta en Marcha

```bash
# 1. Clonar el repositorio
git clone https://github.com/boletaschile/updateboletas.git
cd updateboletas

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local

# 4. Iniciar servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.
