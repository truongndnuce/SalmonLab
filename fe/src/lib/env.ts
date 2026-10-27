export const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000/api/v1';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
