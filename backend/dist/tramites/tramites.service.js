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
exports.TramitesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let TramitesService = class TramitesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findAll() {
        return this.prisma.tramite.findMany({
            where: { activo: true },
            orderBy: { nombre: 'asc' },
            select: {
                id: true,
                nombre: true,
                descripcion: true,
                plazo_dias: true,
                area: { select: { id: true, nombre: true } },
            },
        });
    }
    async findOne(id) {
        const tramite = await this.prisma.tramite.findFirst({
            where: { id, activo: true },
            select: {
                id: true,
                nombre: true,
                descripcion: true,
                plazo_dias: true,
                area: {
                    select: { id: true, nombre: true, horario_atencion: true },
                },
                paso_rel: {
                    orderBy: { orden: 'asc' },
                    select: { orden: true, titulo: true, descripcion: true },
                },
                requisito_rel: {
                    orderBy: [{ obligatorio: 'desc' }, { id: 'asc' }],
                    select: { nombre: true, obligatorio: true },
                },
            },
        });
        if (!tramite)
            throw new common_1.NotFoundException(`No existe el trámite ${id}`);
        return tramite;
    }
};
exports.TramitesService = TramitesService;
exports.TramitesService = TramitesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TramitesService);
//# sourceMappingURL=tramites.service.js.map