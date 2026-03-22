import { NestFactory } from '@nestjs/core';
import { AuthModule } from '../src/auth/auth.module';
import { AuthService } from '../src/auth/auth.service';
import { AppModule } from '../src/app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const authService = app.get(AuthService);

  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'admin123';

  console.log(`Adding admin user: ${username}...`);
  try {
    const result = await authService.registerWithCredentials({
      username,
      passwordPlain: password,
      role: 'admin',
      displayName: username,
      email: `${username.replace(/[^a-zA-Z0-9]/g, '_')}@admin.local`,
      country: 'US',
    });
    console.log('Admin user added successfully:', result.username);
  } catch (err: any) {
    if (err.message === 'Username already taken') {
      console.log('Admin user already exists.');
    } else {
      console.error('Error adding admin user:', err.message);
    }
  }

  await app.close();
}

bootstrap();
