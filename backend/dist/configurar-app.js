"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configurarApp = configurarApp;
const common_1 = require("@nestjs/common");
function configurarApp(app) {
    app.enableCors();
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        stopAtFirstError: true,
    }));
}
//# sourceMappingURL=configurar-app.js.map