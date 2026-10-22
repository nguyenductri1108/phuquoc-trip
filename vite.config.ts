import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the built site works from any host or sub-path (Vercel, Netlify, GitHub Pages)
export default defineConfig({ base: './', plugins: [react()] });
