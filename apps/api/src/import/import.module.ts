import { DynamicModule, Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { IMPORT_RUNTIME_MODE, type ImportRuntimeMode } from './import.constants';

@Module({})
export class ImportModule {
  static register(runtimeMode: ImportRuntimeMode = 'api'): DynamicModule {
    return {
      module: ImportModule,
      controllers: runtimeMode === 'api' ? [ImportController] : [],
      providers: [
        ImportService,
        {
          provide: IMPORT_RUNTIME_MODE,
          useValue: runtimeMode,
        },
      ],
      exports: [ImportService],
    };
  }
}
