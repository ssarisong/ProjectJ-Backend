import { Field, InputType } from '@nestjs/graphql';
import { FileUpload, GraphQLUpload } from 'graphql-upload';

@InputType({ description: '요리 수정 입력 정보' })
export class UpdateCookInput {
  @Field(() => String, { nullable: true, description: '요리 이름' })
  name?: string;

  @Field(() => String, { nullable: true, description: '요리 설명' })
  detail?: string;

  @Field(() => [GraphQLUpload], { nullable: true, description: '요리 이미지' })
  post_images?: FileUpload[];
}
