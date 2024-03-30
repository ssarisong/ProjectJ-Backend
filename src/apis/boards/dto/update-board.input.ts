import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class UpdateBoardInput {
  @Field(() => String)
  id: string;

  @Field(() => String, { nullable: true })
  category?: string;

  @Field(() => String, { nullable: true })
  title?: string;

  @Field(() => String, { nullable: true })
  detail?: string;
}
