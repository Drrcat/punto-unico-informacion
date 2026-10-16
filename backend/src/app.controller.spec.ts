import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Prueba unitaria del endpoint raíz (chequeo de estado)
describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('GET / responde que la API está ok', () => {
    expect(appController.estado()).toEqual({
      estado: 'ok',
      servicio: 'OrientaSede API',
    });
  });
});
