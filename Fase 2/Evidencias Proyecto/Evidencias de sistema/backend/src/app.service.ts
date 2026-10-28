import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  // Respuesta simple para saber que el servidor responde
  estado() {
    return { estado: 'ok', servicio: 'OrientaSede API' };
  }
}
