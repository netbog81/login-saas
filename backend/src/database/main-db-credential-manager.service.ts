import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabaseCredentialManagerBase } from '@curandis/openbao-core';

@Injectable()
export class MainDbCredentialManager extends DatabaseCredentialManagerBase {
  constructor(
    @InjectDataSource() mainDataSource: DataSource,
    eventEmitter: EventEmitter2,
  ) {
    super(mainDataSource, eventEmitter, {
      dataSourceName: 'main',
      eventName: 'credentials.main-db.rotated',
    });
  }
}
