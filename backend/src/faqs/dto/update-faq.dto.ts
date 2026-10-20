import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateFaqDto } from './create-faq.dto';

// Datos para EDITAR una FAQ (PUT /faqs/:id).
// Mismas reglas que CreateFaqDto, pero todos los campos son opcionales:
// se puede cambiar solo la pregunta, solo publicarla, etc.
// creado_por_id no se puede cambiar: el autor queda fijo desde la creación.
export class UpdateFaqDto extends PartialType(
  OmitType(CreateFaqDto, ['creado_por_id'] as const),
) {}
