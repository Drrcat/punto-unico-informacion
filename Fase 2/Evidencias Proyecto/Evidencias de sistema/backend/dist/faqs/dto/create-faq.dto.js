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
exports.CreateFaqDto = void 0;
const class_validator_1 = require("class-validator");
class CreateFaqDto {
    pregunta;
    respuesta;
    categoria_id;
    area_id;
    publicada;
}
exports.CreateFaqDto = CreateFaqDto;
__decorate([
    (0, class_validator_1.MaxLength)(300, { message: 'La pregunta no puede superar 300 caracteres' }),
    (0, class_validator_1.IsString)({ message: 'La pregunta debe ser texto' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'La pregunta no puede estar vacía' }),
    __metadata("design:type", String)
], CreateFaqDto.prototype, "pregunta", void 0);
__decorate([
    (0, class_validator_1.MaxLength)(5000, { message: 'La respuesta no puede superar 5000 caracteres' }),
    (0, class_validator_1.IsString)({ message: 'La respuesta debe ser texto' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'La respuesta no puede estar vacía' }),
    __metadata("design:type", String)
], CreateFaqDto.prototype, "respuesta", void 0);
__decorate([
    (0, class_validator_1.Min)(1, { message: 'categoria_id no es válido' }),
    (0, class_validator_1.IsInt)({ message: 'categoria_id es obligatorio y debe ser un número entero' }),
    __metadata("design:type", Number)
], CreateFaqDto.prototype, "categoria_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Min)(1, { message: 'area_id no es válido' }),
    (0, class_validator_1.IsInt)({ message: 'area_id debe ser un número entero' }),
    __metadata("design:type", Object)
], CreateFaqDto.prototype, "area_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)({ message: 'publicada debe ser true o false' }),
    __metadata("design:type", Boolean)
], CreateFaqDto.prototype, "publicada", void 0);
//# sourceMappingURL=create-faq.dto.js.map