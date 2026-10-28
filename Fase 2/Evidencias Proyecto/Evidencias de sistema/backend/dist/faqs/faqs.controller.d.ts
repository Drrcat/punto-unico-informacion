import { FaqsService } from './faqs.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
export declare class FaqsController {
    private readonly faqsService;
    constructor(faqsService: FaqsService);
    findAll(): import(".prisma/client").Prisma.PrismaPromise<{
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
    findAllForAdmin(): import(".prisma/client").Prisma.PrismaPromise<{
        pregunta: string;
        respuesta: string;
        categoria_id: number;
        publicada: boolean;
        id: number;
        categoria: {
            nombre: string;
        };
    }[]>;
    findCategories(): import(".prisma/client").Prisma.PrismaPromise<{
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
    patch(id: number, datos: UpdateFaqDto): Promise<{
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
}
