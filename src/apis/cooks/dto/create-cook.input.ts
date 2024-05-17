import { Field, InputType } from '@nestjs/graphql';
import { FileUpload, GraphQLUpload } from 'graphql-upload';

@InputType()
export class CreateCookInput {
  @Field(() => String, { description: '요리 이름' })
  name: string;

  @Field(() => String, { description: '요리 설명' })
  detail: string;

  @Field(() => [GraphQLUpload], { description: '요리 이미지' })
  post_images: FileUpload[];
}
