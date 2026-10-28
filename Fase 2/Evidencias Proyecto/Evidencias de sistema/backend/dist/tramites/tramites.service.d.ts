import { PrismaService } from '../prisma/prisma.service';
export declare class TramitesService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): import(".prisma/client").Prisma.PrismaPromise<{
        id: number;
        area: {
            id: number;
            nombre: string;
        };
        nombre: string;
        descripcion: string | null;
        plazo_dias: number | null;
    }[]>;
    findOne(id: number): Promise<{
        id: number;
        area: {
            id: number;
            nombre: string;
            horario_atencion: string | null;
        };
        nombre: string;
        descripcion: string | null;
        plazo_dias: number | null;
        paso_rel: {
            orden: number;
            descripcion: string;
            titulo: string;
        }[];
        requisito_rel: {
            nombre: string;
            obligatorio: boolean;
        }[];
    }>;
}
