import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { FaqsService } from './faqs.service';

@Controller('faqs')
export class FaqsController {
  constructor(private readonly faqsService: FaqsService) {}

  @Get()
  findAll() {
    return this.faqsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.faqsService.findOne(Number(id));
  }

  @Post()
  create(@Body() datos: any) {
    return this.faqsService.create(datos);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() datos: any) {
    return this.faqsService.update(Number(id), datos);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.faqsService.remove(Number(id));
  }
}