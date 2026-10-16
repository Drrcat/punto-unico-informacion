// Forma de una FAQ tal como la devuelve la API (igual al modelo Faq de prisma/schema.prisma)
export class Faq {
  id: number;
  pregunta: string;
  respuesta: string;
  creadaEn: Date;
}
