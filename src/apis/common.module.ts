import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dong } from './area/entities/dong.entity';
import { Sgng } from './area/entities/sgng.entity';
import { Sido } from './area/entities/sido.entity';
import { Board } from './boards/entities/board.entity';
import { Reply } from './boards/entities/reply.entity';
import { Ingredient } from './ingredients/entities/ingredient.entity';
import { Letter } from './letters/entities/letter.entity';
import { LikeUserRecord } from './like/entities/like_user_record.entity';
import { OneRoom } from './oneroom/entities/one_room.entity';
import { Notification } from './notifications/entities/notification.entity';
import { UsedProduct } from './used_markets/entities/used_product.entity';
import { User } from './users/entities/user.entity';
import { Token } from './users/entities/token.entity';
import { BoardService } from './boards/boards.service';
import { IngredientService } from './ingredients/ingredient.service';
import { AreaService } from './area/area.service';
import { LetterService } from './letters/letters.service';
import { LikeUserRecordService } from './like/like_user_record.service';
import { NotificationService } from './notifications/notifications.service';
import { OneRoomService } from './oneroom/oneroom.service';
import { UsedProductService } from './used_markets/usedProducts.service';
import { NotificationMessages } from './notifications/notifications.messages';
import { HttpModule } from '@nestjs/axios';
import { UserService } from './users/users.service';
import { Point } from './point/entity/point.entity';
import { PointService } from './point/point.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Dong,
      Sgng,
      Sido,
      Board,
      Reply,
      Ingredient,
      Letter,
      LikeUserRecord,
      Notification,
      OneRoom,
      UsedProduct,
      User,
      Token,
      Point,
    ]),
    JwtModule.register({}),
    HttpModule,
  ],
  providers: [
    AreaService,
    BoardService,
    IngredientService,
    LetterService,
    LikeUserRecordService,
    NotificationService,
    OneRoomService,
    UsedProductService,
    UserService,
    NotificationMessages,
    PointService,
  ],
  exports: [
    AreaService,
    BoardService,
    IngredientService,
    LetterService,
    LikeUserRecordService,
    NotificationService,
    OneRoomService,
    UsedProductService,
    UserService,
    NotificationMessages,
    PointService,
  ],
})
export class CommonModule {}
