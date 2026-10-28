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
exports.AreasService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const camposArea = {
    id: true,
    nombre: true,
    descripcion: true,
    horario_atencion: true,
    correo_contacto: true,
    anexo: true,
    espacio: {
        select: {
            codigo: true,
            nombre: true,
            svg_element_id: true,
            piso: {
                select: {
                    numero: true,
                    nombre: true,
                    edificio: { select: { nombre: true } },
                },
            },
        },
    },
};
let AreasService = class AreasService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findAll() {
        return this.prisma.area_institucional.findMany({
            orderBy: { nombre: 'asc' },
            select: camposArea,
        });
    }
    async findOne(id) {
        const area = await this.prisma.area_institucional.findUnique({
            where: { id },
            select: {
                ...camposArea,
                tramite_rel: {
                    where: { activo: true },
                    orderBy: { nombre: 'asc' },
                    select: { id: true, nombre: true },
                },
            },
        });
        if (!area)
            throw new common_1.NotFoundException(`No existe el área ${id}`);
        return area;
    }
};
exports.AreasService = AreasService;
exports.AreasService = AreasService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AreasService);
//# sourceMappingURL=areas.service.js.map