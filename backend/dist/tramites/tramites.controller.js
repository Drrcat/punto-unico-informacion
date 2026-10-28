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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TramitesController = void 0;
const common_1 = require("@nestjs/common");
const tramites_service_1 = require("./tramites.service");
let TramitesController = class TramitesController {
    tramitesService;
    constructor(tramitesService) {
        this.tramitesService = tramitesService;
    }
    findAll() {
        return this.tramitesService.findAll();
    }
    findOne(id) {
        return this.tramitesService.findOne(id);
    }
};
exports.TramitesController = TramitesController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TramitesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], TramitesController.prototype, "findOne", null);
exports.TramitesController = TramitesController = __decorate([
    (0, common_1.Controller)('tramites'),
    __metadata("design:paramtypes", [tramites_service_1.TramitesService])
], TramitesController);
//# sourceMappingURL=tramites.controller.js.map