import { Test, TestingModule } from '@nestjs/testing';
import { FaqsController } from './faqs.controller';
import { FaqsService } from './faqs.service';
import { CreateFaqDto } from './dto/create-faq.dto';

// Pruebas unitarias del controlador: verifican que cada ruta llame al
// método correcto del servicio con los parámetros correctos.
describe('FaqsController', () => {
  let controller: FaqsController;

  // Servicio falso: no se prueba la base aquí, solo el "cableado" de las rutas
  const serviceMock = {
    findAll: jest.fn().mockResolvedValue([]),
    findAllForAdmin: jest.fn().mockResolvedValue([]),
    findCategories: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 1 }),
    create: jest.fn().mockResolvedValue({ id: 2 }),
    update: jest.fn().mockResolvedValue({ id: 1 }),
    remove: jest.fn().mockResolvedValue({ id: 1 }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FaqsController],
      providers: [{ provide: FaqsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<FaqsController>(FaqsController);
  });

  it('GET /faqs llama a findAll', async () => {
    await controller.findAll();
    expect(serviceMock.findAll).toHaveBeenCalled();
  });

  it('GET /faqs/admin llama a findAllForAdmin', async () => {
    await controller.findAllForAdmin();
    expect(serviceMock.findAllForAdmin).toHaveBeenCalled();
  });

  it('GET /faqs/categorias llama a findCategories', async () => {
    await controller.findCategories();
    expect(serviceMock.findCategories).toHaveBeenCalled();
  });

  it('GET /faqs/:id llama a findOne con el id', async () => {
    await controller.findOne(1);
    expect(serviceMock.findOne).toHaveBeenCalledWith(1);
  });

  it('POST /faqs llama a create con el body', async () => {
    const datos: CreateFaqDto = {
      pregunta: 'P',
      respuesta: 'R',
      categoria_id: 1,
    };
    await controller.create(datos);
    expect(serviceMock.create).toHaveBeenCalledWith(datos);
  });

  it('PUT /faqs/:id llama a update con id y body', async () => {
    await controller.update(1, { pregunta: 'Editada' });
    expect(serviceMock.update).toHaveBeenCalledWith(1, { pregunta: 'Editada' });
  });

  it('PATCH /faqs/:id llama a update con id y body', async () => {
    await controller.patch(1, { pregunta: 'Editada' });
    expect(serviceMock.update).toHaveBeenCalledWith(1, { pregunta: 'Editada' });
  });

  it('DELETE /faqs/:id llama a remove con el id', async () => {
    await controller.remove(1);
    expect(serviceMock.remove).toHaveBeenCalledWith(1);
  });
});
