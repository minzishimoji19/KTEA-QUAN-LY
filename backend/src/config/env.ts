import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.union([z.string(), z.number()]).default('5000').transform((val) => typeof val === 'string' ? parseInt(val, 10) : val),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  FRONTEND_API_URL: z.string().default('http://localhost:5173'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  VAPID_PUBLIC_KEY: z.string().default('BEMG837SqZ_j5tIMFcT-SnswB6YBdnS8zW-mwjCRWcxzuZpFWnK0WLMHCaGTWHgREvCkSuLMZ3kqciWP7CeGaJk'),
  VAPID_PRIVATE_KEY: z.string().default('f2-A2b55x1-I4LK29x56325451sx5BLGH7tPEa-sm8w'),
  VAPID_SUBJECT: z.string().default('mailto:admin@kteacrm.com'),
  PUSH_AUTH_PASSKEY: z.string().default('ktea-crm-2026'),
  CRON_SECRET: z.string().default('ktea-cron-secret-2026'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment configuration:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
