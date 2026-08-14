import { Module } from '@nestjs/common';
import { createS3ReleaseStorage } from '@planner-fin/storage';
import { AuthModule } from '../auth/auth.module';
import { loadReleaseStorageConfig } from './release-storage.config';
import { ReleasesController } from './releases.controller';
import { ReleasesService } from './releases.service';
import { RELEASE_STORAGE } from './releases.tokens';

@Module({
  imports: [AuthModule],
  controllers: [ReleasesController],
  providers: [
    ReleasesService,
    {
      provide: RELEASE_STORAGE,
      useFactory: () => {
        const config = loadReleaseStorageConfig();
        return config ? createS3ReleaseStorage(config) : null;
      },
    },
  ],
})
export class ReleasesModule {}
