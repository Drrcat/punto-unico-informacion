"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FaqsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const camposPublicos = {
    id: true,
    pregunta: true,
    respuesta: true,
    categoria: { select: { nombre: true } },
    area: { select: { nombre: true } },
};
let FaqsService = class FaqsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findAll() {
        return this.prisma.pregunta_frecuente.findMany({
            where: { publicada: true },
            orderBy: { id: 'asc' },
            select: camposPublicos,
        });
    }
    findAllForAdmin() {
        return this.prisma.pregunta_frecuente.findMany({
            orderBy: { id: 'asc' },
            select: {
                id: true,
                pregunta: true,
                respuesta: true,
                publicada: true,
                categoria_id: true,
                categoria: { select: { nombre: true } },
            },
        });
    }
    findCategories() {
        return this.prisma.categoria_faq.findMany({
            orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
            select: { id: true, nombre: true },
        });
    }
    async findOne(id) {
        const faq = await this.prisma.pregunta_frecuente.findFirst({
            where: { id, publicada: true },
            select: camposPublicos,
        });
        if (!faq)
            throw new common_1.NotFoundException(`No existe la pregunta ${id}`);
        return faq;
    }
    create(datos) {
        const creadorId = Number(process.env.FAQ_CREATED_BY_ID);
        if (!Number.isInteger(creadorId) || creadorId < 1) {
            throw new common_1.ServiceUnavailableException('Configura FAQ_CREATED_BY_ID con el id de un usuario existente antes de crear preguntas frecuentes');
        }
        return this.guardar(() => this.prisma.pregunta_frecuente.create({
            data: {
                pregunta: datos.pregunta,
                respuesta: datos.respuesta,
                categoria_id: datos.categoria_id,
                ...(datos.area_id !== undefined ? { area_id: datos.area_id } : {}),
                ...(datos.publicada !== undefined
                    ? { publicada: datos.publicada }
                    : {}),
                creado_por_id: creadorId,
            },
        }));
    }
    async update(id, datos) {
        await this.verificarQueExiste(id);
        return this.guardar(() => this.prisma.pregunta_frecuente.update({ where: { id }, data: datos }));
    }
    async remove(id) {
        await this.verificarQueExiste(id);
        return this.prisma.pregunta_frecuente.delete({ where: { id } });
    }
    async verificarQueExiste(id) {
        const faq = await this.prisma.pregunta_frecuente.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!faq)
            throw new common_1.NotFoundException(`No existe la pregunta ${id}`);
    }
    async guardar(operacion) {
        try {
            return await operacion();
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2003') {
                throw new common_1.BadRequestException('La categoría, el área o el usuario indicado no existe');
            }
            throw error;
        }
    }
};
exports.FaqsService = FaqsService;
exports.FaqsService = FaqsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FaqsService);
//# sourceMappingURL=faqs.service.js.map