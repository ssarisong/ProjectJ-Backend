import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './apis/users/users.module';
import { UsedProductModule } from './apis/used_markets/usedProducts.module';
import { AreaModule } from './apis/area/area.module';
import { BoardModule } from './apis/boards/boards.module';
import { LetterModule } from './apis/letters/letters.module';
import { OneRoomModule } from './apis/oneroom/oneroom.module';
import { NotificationModule } from './apis/notifications/notifications.module';
import { PointModule } from './apis/point/point.module';
import { PostImageModule } from './apis/post_image/postImage.module';
import { graphqlUploadExpress } from 'graphql-upload';
import { CookModule } from './apis/cooks/cook.module';
@Module({
  imports: [
    UserModule,
    UsedProductModule,
    AreaModule,
    BoardModule,
    LetterModule,
    OneRoomModule,
    NotificationModule,
    PointModule,
    PostImageModule,
    CookModule,
    ConfigModule.forRoot(),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: 'src/commons/graphql/schema.gql',
      csrfPrevention: false,
      context: ({ req, res }) => ({ req, res }),
    }),
    TypeOrmModule.forRoot({
      type: process.env.DATABASE_TYPE as 'mysql',
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT),
      username: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_DATABASE,
      entities: [__dirname + '/apis/**/*.entity.*'],
      synchronize: true,
      logging: true,
    }),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(graphqlUploadExpress()).forRoutes('graphql');
  }
}
