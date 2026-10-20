import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { FaqsService } from './faqs.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';

// ParseIntPipe responde 400 si el id no es un número (ej: /faqs/abc)
@Controller('faqs')
export class FaqsController {
  constructor(private readonly faqsService: FaqsService) {}

  @Get()
  findAll() {
    return this.faqsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.faqsService.findOne(id);
  }

  @Post()
  create(@Body() datos: CreateFaqDto) {
    return this.faqsService.create(datos);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() datos: UpdateFaqDto) {
    return this.faqsService.update(id, datos);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.faqsService.remove(id);
  }
}
