import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('Root & Health')
@Controller()
export class AppController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'API Status & Health Check' })
  getRoot() {
    return {
      name: 'DART.ng API',
      version: '1.0.0',
      status: 'operational',
      environment: process.env.NODE_ENV || 'development',
      documentation: '/api/docs',
      timestamp: new Date().toISOString(),
    };
  }
}
