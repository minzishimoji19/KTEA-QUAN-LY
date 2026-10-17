import prisma from '../config/database.js';
import { userService } from '../services/user.service.js';
import { env } from '../config/env.js';

async function bootstrap() {
  console.log('--- KTEA CRM Admin Bootstrap Tool ---');

  const name = env.BOOTSTRAP_ADMIN_NAME;
  const email = env.BOOTSTRAP_ADMIN_EMAIL;
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Lỗi: BOOTSTRAP_ADMIN_EMAIL và BOOTSTRAP_ADMIN_PASSWORD phải được cung cấp qua biến môi trường.');
    process.exit(1);
  }

  try {
    const result = await userService.bootstrapFirstAdmin({
      fullName: name || 'Admin KTEA',
      email,
      password,
    });

    console.log(`[Kết quả] ${result.message}`);
    if (result.user) {
      console.log(`- ID: ${result.user.id}`);
      console.log(`- Email: ${result.user.email}`);
      console.log(`- Tên: ${result.user.fullName}`);
      console.log(`- Quyền: ${result.user.role}`);
    }
  } catch (error) {
    console.error('Lỗi bootstrap Admin:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

bootstrap();
