import { AreasService } from './areas.service';
export declare class AreasController {
    private readonly areasService;
    constructor(areasService: AreasService);
    findAll(): import(".prisma/client").Prisma.PrismaPromise<{
        espacio: {
            piso: {
                edificio: {
                    nombre: string;
                };
                nombre: string;
                numero: number;
            };
            nombre: string | null;
            codigo: string;
            svg_element_id: string | null;
        } | null;
        id: number;
        nombre: string;
        descripcion: string | null;
        horario_atencion: string | null;
        correo_contacto: string | null;
        anexo: string | null;
    }[]>;
    findOne(id: number): Promise<{
        espacio: {
            piso: {
                edificio: {
                    nombre: string;
                };
                nombre: string;
                numero: number;
            };
            nombre: string | null;
            codigo: string;
            svg_element_id: string | null;
        } | null;
        id: number;
        nombre: string;
        descripcion: string | null;
        horario_atencion: string | null;
        correo_contacto: string | null;
        anexo: string | null;
        tramite_rel: {
            id: number;
            nombre: string;
        }[];
    }>;
}
