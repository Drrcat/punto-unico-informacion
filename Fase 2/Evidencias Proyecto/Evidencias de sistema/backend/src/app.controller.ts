import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // GET /  → chequeo rápido de que la API está viva (lo usa Docker y sirve para probar)
  @Get()
  estado() {
    return this.appService.estado();
  }
}
