import { PartialType } from '@nestjs/mapped-types';
import { CreateFaqDto } from './create-faq.dto';

// Datos para EDITAR una FAQ (PATCH /faqs/:id).
// Mismas reglas que CreateFaqDto, pero todos los campos son opcionales:
// se puede cambiar solo la pregunta, solo la respuesta o ambas.
export class UpdateFaqDto extends PartialType(CreateFaqDto) {}
