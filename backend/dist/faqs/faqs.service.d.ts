import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
export declare class FaqsService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Prisma.PrismaPromise<{
        pregunta: string;
        respuesta: string;
        id: number;
        categoria: {
            nombre: string;
        };
        area: {
            nombre: string;
        } | null;
    }[]>;
    findAllForAdmin(): Prisma.PrismaPromise<{
        pregunta: string;
        respuesta: string;
        categoria_id: number;
        publicada: boolean;
        id: number;
        categoria: {
            nombre: string;
        };
    }[]>;
    findCategories(): Prisma.PrismaPromise<{
        id: number;
        nombre: string;
    }[]>;
    findOne(id: number): Promise<{
        pregunta: string;
        respuesta: string;
        id: number;
        categoria: {
            nombre: string;
        };
        area: {
            nombre: string;
        } | null;
    }>;
    create(datos: CreateFaqDto): Promise<{
        pregunta: string;
        respuesta: string;
        categoria_id: number;
        area_id: number | null;
        publicada: boolean;
        id: number;
        creado_por_id: number;
        creado_en: Date;
        actualizado_en: Date;
    }>;
    update(id: number, datos: UpdateFaqDto): Promise<{
        pregunta: string;
        respuesta: string;
        categoria_id: number;
        area_id: number | null;
        publicada: boolean;
        id: number;
        creado_por_id: number;
        creado_en: Date;
        actualizado_en: Date;
    }>;
    remove(id: number): Promise<{
        pregunta: string;
        respuesta: string;
        categoria_id: number;
        area_id: number | null;
        publicada: boolean;
        id: number;
        creado_por_id: number;
        creado_en: Date;
        actualizado_en: Date;
    }>;
    private verificarQueExiste;
    private guardar;
}
