<template>
  <RouterView />
</template>

<style>
/* ── Design system 2026 — Glassmorphism + Digital Lavender ── */

:root {
  /* Glass tokens */
  --glass-bg:          rgba(255, 255, 255, 0.22);
  --glass-bg-md:       rgba(255, 255, 255, 0.50);
  --glass-bg-strong:   rgba(255, 255, 255, 0.68);
  --glass-border:      rgba(255, 255, 255, 0.45);
  --glass-blur:        blur(22px) saturate(180%);
  --glass-shadow:      0 8px 32px rgba(107, 70, 193, 0.10);

  /* Palette — Digital Lavender 2026 */
  --violet-50:  #faf5ff;
  --violet-100: #ede9fe;
  --violet-200: #ddd6fe;
  --violet-300: #c4b5fd;
  --violet-400: #a78bfa;
  --violet-500: #8b5cf6;
  --violet-600: #7c3aed;
  --violet-700: #6d28d9;
  --violet-800: #5b21b6;
  --violet-900: #4c1d95;

  --indigo-400: #818cf8;
  --cyan-300:   #67e8f9;
  --rose-300:   #f9a8d4;
  --sage-300:   #86efac;

  /* App background */
  --app-bg: linear-gradient(
    135deg,
    #faf5ff 0%,
    #ede9fe 20%,
    #e0f2fe 48%,
    #f0fdf4 78%,
    #fdf4ff 100%
  );

  /* Text */
  --text-primary:  #1e1b4b;
  --text-muted:    #6b7280;
  --text-subtle:   #9ca3af;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--app-bg);
  background-attachment: fixed;
  min-height: 100vh;
  margin: 0;
  padding: 0;
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Scrollbar */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(139, 92, 246, 0.25);
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover { background: rgba(139, 92, 246, 0.45); }

/* ── PrimeVue global glass overrides ── */

/* Card */
.p-card {
  background: rgba(255, 255, 255, 0.55) !important;
  backdrop-filter: var(--glass-blur) !important;
  -webkit-backdrop-filter: var(--glass-blur) !important;
  border: 1px solid rgba(255, 255, 255, 0.65) !important;
  border-radius: 20px !important;
  box-shadow: 0 4px 24px rgba(139, 92, 246, 0.08), inset 0 1px 0 rgba(255,255,255,0.75) !important;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.p-card:hover {
  box-shadow: 0 8px 32px rgba(139, 92, 246, 0.14), inset 0 1px 0 rgba(255,255,255,0.75) !important;
  transform: translateY(-2px);
}

.p-card .p-card-title {
  font-size: 0.8125rem !important;
  font-weight: 600 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.06em !important;
  color: #7c6fa0 !important;
}

/* InputText glass */
.p-inputtext {
  background: rgba(255, 255, 255, 0.55) !important;
  border: 1.5px solid rgba(196, 181, 253, 0.45) !important;
  border-radius: 12px !important;
  color: var(--text-primary) !important;
  font-family: inherit !important;
  transition: border-color 0.18s, box-shadow 0.18s, background 0.18s !important;
}

.p-inputtext:hover {
  border-color: rgba(139, 92, 246, 0.45) !important;
}

.p-inputtext:focus {
  border-color: #a78bfa !important;
  box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.18) !important;
  background: rgba(255, 255, 255, 0.78) !important;
}

.p-inputtext::placeholder { color: #a5b4fc !important; }

/* Button primary */
.p-button.p-button-primary,
.p-button:not(.p-button-secondary):not(.p-button-success):not(.p-button-warning):not(.p-button-danger):not(.p-button-info):not(.p-button-help):not(.p-button-text):not(.p-button-outlined):not(.p-button-link) {
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%) !important;
  border-color: transparent !important;
  box-shadow: 0 4px 18px rgba(139, 92, 246, 0.32) !important;
  border-radius: 12px !important;
  font-weight: 600 !important;
  transition: all 0.2s ease !important;
}

.p-button.p-button-primary:hover,
.p-button:not(.p-button-secondary):not(.p-button-success):not(.p-button-warning):not(.p-button-danger):not(.p-button-info):not(.p-button-help):not(.p-button-text):not(.p-button-outlined):not(.p-button-link):hover {
  background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%) !important;
  box-shadow: 0 8px 28px rgba(139, 92, 246, 0.42) !important;
  transform: translateY(-1px) !important;
}

/* Tag glass */
.p-tag {
  border-radius: 8px !important;
  font-size: 0.6875rem !important;
  font-weight: 600 !important;
  letter-spacing: 0.04em !important;
  text-transform: uppercase !important;
}

/* Common page layout utilities */
.page-wrapper {
  max-width: 1280px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.75rem;
}

.page-header h1,
.page-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 1.25rem;
}

.stat-value {
  font-size: 2.25rem;
  font-weight: 700;
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
</style>
