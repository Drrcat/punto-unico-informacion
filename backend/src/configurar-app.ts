import { INestApplication, ValidationPipe } from '@nestjs/common';

// Configuración común de la app. Se usa en main.ts y también en las pruebas e2e,
// así las pruebas validan exactamente lo mismo que la API real.
export function configurarApp(app: INestApplication) {
  // Permite que el front-end (otro origen/puerto) llame a la API
  app.enableCors();

  // Valida automáticamente los datos que llegan en el body según los DTO:
  // - whitelist: descarta campos que no están en el DTO
  // - forbidNonWhitelisted: responde 400 si mandan campos desconocidos
  // - stopAtFirstError: un solo mensaje por campo (más fácil de leer)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: true,
    }),
  );
}
