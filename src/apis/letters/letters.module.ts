import { Module } from '@nestjs/common';
import { LetterResolver } from './letters.resolver';
import { CommonModule } from '../common.module';

@Module({
  imports: [CommonModule],
  providers: [LetterResolver],
})
export class LetterModule {}
