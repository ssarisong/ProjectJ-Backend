import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  forwardRef,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Board } from './entities/board.entity';
import { UpdateBoardInput } from './dto/update-board.input';
import { Like } from 'typeorm';
import { SearchBoardInput } from './dto/search_board.input';
import { CreateBoardInput } from './dto/create-board.input';
import { UserService } from '../users/users.service';
import { LikeUserRecord } from '../like/entities/like_user_record.entity';
import { Reply } from './entities/reply.entity';
import { NotificationService } from '../notifications/notifications.service';
import { PointService } from '../point/point.service';
import { PostImage } from '../post_image/entities/postImage.entity';
import { PostImageService } from '../post_image/postImage.service';
import { CommentReply } from './entities/commet_reply.entity';
import { FileUpload } from 'graphql-upload';
import * as path from 'path';
@Injectable()
export class BoardService {
  constructor(
    @InjectRepository(Board)
    private readonly boardRepository: Repository<Board>,
    @InjectRepository(LikeUserRecord)
    private readonly likeUserRecordRepository: Repository<LikeUserRecord>,
    @InjectRepository(PostImage)
    private readonly postImageRepository: Repository<PostImage>,
    @InjectRepository(Reply)
    private readonly replyRepository: Repository<Reply>,
    @InjectRepository(CommentReply)
    private readonly commentReplyRepository: Repository<CommentReply>,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => PointService))
    private readonly pointService: PointService,
    @Inject(forwardRef(() => PostImageService))
    private readonly postImageService: PostImageService,
  ) {}

  async findAll(category: string): Promise<Board[]> {
    return await this.boardRepository.find({
      where: { category: category },
      relations: ['user', 'reply', 'like_user'],
    });
  }

  async findById(id: string): Promise<Board> {
    return await this.boardRepository.findOne({
      where: { id: id },
      relations: ['user', 'reply', 'like_user'],
    });
  }

  async findByUserId(user_id: string): Promise<Board[]> {
    return await this.boardRepository.find({
      where: { user: { id: user_id } },
      relations: ['user', 'reply', 'like_user'],
    });
  }

  async findBySerach(searchBoardInput: SearchBoardInput): Promise<Board[]> {
    const { title, detail, category } = searchBoardInput;
    const searchConditions: any = {};
    if (category) {
      searchConditions.category = category;
    }

    if (title) {
      searchConditions.title = Like(`%${title}%`);
    }

    if (detail) {
      searchConditions.detail = Like(`%${detail}%`);
    }

    return await this.boardRepository.find({ where: searchConditions });
  }

  async findTopBoards(category: string, rank: number): Promise<Board[]> {
    const boards = await this.boardRepository.find({
      where: { category: category },
      order: { like: 'DESC' },
      relations: ['user'],
      take: rank,
    });

    for (const rankBoard of boards) {
      await this.pointService.increase(rankBoard.user.id, +100);
    }
    return boards;
  }

  async create(
    folder: string,
    files: FileUpload[] | FileUpload,
    user_id: string,
    createBoardInput: CreateBoardInput,
  ): Promise<Board> {
    const { title, detail, category } = createBoardInput;
    const user = await this.userService.findById(user_id);
    const board = new Board();
    board.title = title;
    board.detail = detail;
    board.category = category;
    board.create_at = new Date();
    board.user = user;
    board.post_images = [];
    await this.boardRepository.save(board);
    if (!user) {
      throw new Error('해당 사용자가 존재하지 않습니다');
    }
    if (files) {
      if (Array.isArray(files)) {
        for (const file of files) {
          const url = await this.postImageService.saveImageToS3(folder, file);
          const postImage = new PostImage();
          postImage.board = board;
          postImage.imagePath = url;
          board.post_images.push(postImage);
          await this.postImageRepository.save(postImage);
        }
      } else {
        const url = await this.postImageService.saveImageToS3(folder, files);
        const postImage = new PostImage();
        postImage.board = board;
        postImage.imagePath = url;
        board.post_images.push(postImage);
        await this.postImageRepository.save(postImage);
      }
    }
    await this.pointService.increase(user.id, +10);
    return await this.boardRepository.save(board);
  }

  async update(
    folder: string,
    file: FileUpload[],
    user_id: string,
    updateBoradInput: UpdateBoardInput,
  ): Promise<Board> {
    const { id, ...rest } = updateBoradInput;
    const board = await this.findById(id);
    if (!board) {
      throw new NotFoundException(`ID가 ${id}인 게시글을 찾을 수 없습니다.`);
    }
    if (board.user.id !== user_id) {
      throw new ForbiddenException(
        `본인이 작성한 게시글만 수정할 수 있습니다.`,
      );
    }
    const newImageUrls: string[] = [];
    //기존 postImage에서 없는 이미지 삽입
    for (const item of file) {
      const key = `${folder}/${Date.now()}_${path.basename(
        item.filename,
      )}`.replace(/ /g, '');
      const s3Url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${key}`;
      newImageUrls.push(s3Url);
      if (
        !board.post_images.some(
          (postImage: PostImage) => postImage.imagePath === s3Url,
        )
      ) {
        // const imgUrl = await this.postImageService.saveImageToS3(folder, file);
        const postImage = new PostImage();
        postImage.board = board;
        // postImage.imagePath = imgUrl[0];
        board.post_images.push(postImage);
        await this.postImageRepository.save(postImage);
      }
    }
    for (let i = board.post_images.length - 1; i >= 0; i--) {
      const post_image = board.post_images[i];
      if (
        !newImageUrls.some(
          (newImageUrl: string) => newImageUrl === post_image.imagePath,
        )
      )
        this.postImageService.deleteImageFromS3(post_image.imagePath);
      this.postImageRepository.delete(post_image.id);
      board.post_images.splice(i, 1);
    }
    await this.boardRepository.update({ id: id }, { ...rest });
    return await this.boardRepository.findOne({
      where: { id: id },
      relations: ['user'],
    });
  }

  async delete(user_id: string, board_id: string): Promise<boolean> {
    const board = await this.findById(board_id);
    if (!board) {
      throw new NotFoundException(
        `ID가 ${board_id}인 게시글을 찾을 수 없습니다.`,
      );
    }
    if (board.user.id !== user_id) {
      throw new ForbiddenException(
        `본인이 작성한 게시글만 수정할 수 있습니다.`,
      );
    }
    for (const post_image of board.post_images) {
      await this.postImageService.deleteImageFromS3(post_image.imagePath);
    }
    await this.pointService.increase(board.user.id, -10);
    const result = await this.boardRepository.delete(board_id);
    return result.affected ? true : false;
  }
  async addViewCount(id: string): Promise<Board> {
    const board = await this.findById(id);
    if (!board) {
      throw new NotFoundException(`Id가 ${id}인 것을 찾을 수 없습니다.`);
    }
    board.view = board.view + 1;

    await this.boardRepository.save(board);
    return await this.boardRepository.findOne({
      where: { id: id },
      relations: ['user'],
    });
  }

  async addLike(user_id: string, id: string): Promise<Board> {
    const board = await this.findById(id);
    const like_user_record = new LikeUserRecord();
    const user = await this.userService.findById(user_id);
    const checkuser = await this.likeUserRecordRepository.findOne({
      where: { board: { id: board.id }, user: { id: user.id } },
      relations: ['user', 'board'],
    });
    if (board.user.id === user_id) {
      throw new ForbiddenException('자신의 게시글은 좋아요 할 수 없습니다');
    }
    if (checkuser) {
      throw new ForbiddenException(`이미 좋아요한 게시글 입니다.`);
    }
    await this.pointService.increase(board.user.id, +5);
    board.like = board.like + 1;
    like_user_record.board = board;
    like_user_record.user = user;
    board.like_user.push(like_user_record);
    const like = await this.likeUserRecordRepository.save(like_user_record);
    await this.boardRepository.save(board);
    await this.notificationService.create(like.id, '202');
    return await this.findById(id);
  }

  async deleteLike(user_id: string, id: string): Promise<Board> {
    const board = await this.findById(id);
    const user = await this.userService.findById(user_id);
    const checkuser = await this.likeUserRecordRepository.findOne({
      where: { board: { id: board.id }, user: { id: user.id } },
      relations: ['user', 'board'],
    });
    if (!checkuser) {
      throw new NotFoundException('좋아요를 하지 않았습니다.');
    }
    await this.pointService.increase(board.user.id, -5);
    board.like = board.like - 1;
    const likeIndex = board.like_user.findIndex(
      (likeUsers) => likeUsers.id === checkuser.id,
    );
    board.like_user.splice(likeIndex, 1);
    await this.likeUserRecordRepository.delete(checkuser.id);
    await this.boardRepository.save(board);
    return await this.findById(id);
  }
  async addReply(user_id: string, detail: string, id: string): Promise<Board> {
    const board = await this.findById(id);
    const user = await this.userService.findById(user_id);
    const reply = new Reply();
    if (
      detail.includes('씨발') ||
      detail.includes('개새끼') ||
      detail.includes('병신')
    ) {
      throw new HttpException(
        '댓글 내용에 욕이 포함되어 있어 작성할 수 없습니다.',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.pointService.increase(user.id, 1);
    reply.user = user;
    reply.board = board;
    reply.detail = detail;
    board.reply.push(reply);
    const result = await this.replyRepository.save(reply);
    await this.boardRepository.save(board);
    await this.notificationService.create(result.id, '300');
    return await this.findById(id);
  }
  async deleteReply(user_id: string, reply_id: string): Promise<Board> {
    const checkreply = await this.replyRepository.findOne({
      where: { id: reply_id },
      relations: ['user', 'board'],
    });
    const board = await this.findById(checkreply.board.id);
    if (checkreply.user.id !== user_id) {
      throw new ForbiddenException(`본인이 작성한 댓글만 삭제할 수 있습니다.`);
    }
    if (!checkreply) {
      throw new NotFoundException('댓글이 존재하지 않습니다.');
    }
    const replyIndex = board.reply.findIndex(
      (reply) => reply.id === checkreply.id,
    );
    await this.pointService.increase(user_id, -1);
    board.reply.splice(replyIndex, 1);
    await this.replyRepository.delete(checkreply.id);
    await this.boardRepository.save(board);
    return await this.findById(board.id);
  }

  async updateReply(
    detail: string,
    reply_id: string,
    user_id: string,
  ): Promise<Board> {
    const checkreply = await this.replyRepository.findOne({
      where: { id: reply_id },
      relations: ['user', 'board'],
    });
    if (checkreply.user.id !== user_id) {
      throw new ForbiddenException(`본인이 작성한 댓글만 수정할 수 있습니다.`);
    }
    if (!checkreply) {
      throw new NotFoundException('댓글이 존재하지 않습니다.');
    }
    if (
      detail.includes('씨발') ||
      detail.includes('개새끼') ||
      detail.includes('병신')
    ) {
      throw new HttpException(
        '댓글 내용에 욕이 포함되어 있어 작성할 수 없습니다.',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.replyRepository.update(
      { id: checkreply.id },
      { detail: detail },
    );
    return await this.findById(checkreply.board.id);
  }

  async addReplyLike(user_id: string, reply_id: string): Promise<boolean> {
    const reply = await this.replyRepository.findOne({
      where: { id: reply_id },
      relations: ['like_user', 'user'],
    });

    let target: CommentReply | Reply;

    if (!reply) {
      const commentReply = await this.commentReplyRepository.findOne({
        where: { id: reply_id },
        relations: ['like_user', 'user'],
      });

      if (!commentReply) {
        throw new NotFoundException('해당 댓글을 찾을 수 없습니다.');
      }

      target = commentReply;
    } else {
      target = reply;
    }

    const user = await this.userService.findById(user_id);

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const checkreply = await this.likeUserRecordRepository.findOne({
      where: { reply: { id: target.id }, user: { id: user.id } },
      relations: ['user', 'reply'],
    });

    if (target.user.id === user_id) {
      throw new ForbiddenException('자신의 댓글은 좋아요 할 수 없습니다.');
    }

    if (checkreply) {
      throw new ForbiddenException('이미 좋아요한 댓글입니다.');
    }

    await this.pointService.increase(target.user.id, 5);

    target.like = target.like + 1;

    const like_user_record = new LikeUserRecord();

    like_user_record.user = user;

    let savedTarget: Reply | CommentReply;
    if (target instanceof Reply) {
      savedTarget = await this.replyRepository.save(target);
      like_user_record.reply = target;
    } else {
      savedTarget = await this.commentReplyRepository.save(target);
      like_user_record.commet_reply = target;
    }
    target.like_user.push(like_user_record);

    const savedLikeUserRecord = await this.likeUserRecordRepository.save(
      like_user_record,
    );
    await this.notificationService.create(savedLikeUserRecord.id, '203');

    return !!savedTarget;
  }

  async deleteReplyLike(user_id: string, reply_id: string): Promise<boolean> {
    const reply = await this.replyRepository.findOne({
      where: { id: reply_id },
      relations: ['like_user', 'user'],
    });

    let target: CommentReply | Reply;
    let checkreply: LikeUserRecord;
    if (!reply) {
      const commentReply = await this.commentReplyRepository.findOne({
        where: { id: reply_id },
        relations: ['like_user', 'user'],
      });

      if (!commentReply) {
        throw new NotFoundException('해당 댓글을 찾을 수 없습니다.');
      }

      target = commentReply;
    } else {
      target = reply;
    }
    if (target instanceof CommentReply) {
      checkreply = await this.likeUserRecordRepository.findOne({
        where: { commet_reply: { id: target.id }, user: { id: user_id } },
        relations: ['user', 'comment_reply'],
      });
    } else {
      checkreply = await this.likeUserRecordRepository.findOne({
        where: { reply: { id: target.id }, user: { id: user_id } },
        relations: ['user', 'reply'],
      });
    }
    if (!checkreply) {
      throw new ForbiddenException(`좋아요를 하지 않았습니다.`);
    }

    await this.pointService.increase(target.user.id, -5);

    target.like = target.like - 1;

    const likeIndex = target.like_user.findIndex(
      (likeUser) => likeUser.id === checkreply.id,
    );
    target.like_user.splice(likeIndex, 1);

    await this.likeUserRecordRepository.delete(checkreply.id);
    let savedTarget: Reply | CommentReply;
    if (target instanceof Reply) {
      savedTarget = await this.replyRepository.save(target);
    } else {
      savedTarget = await this.commentReplyRepository.save(target);
    }
    return !!savedTarget;
  }

  async findReplyById(reply_id: string): Promise<Reply> {
    return await this.replyRepository.findOne({
      where: { id: reply_id },
      relations: ['user', 'board', 'board.user'],
    });
  }

  async addCommnetReply(
    user_id: string,
    reply_id: string,
    detail: string,
  ): Promise<Board> {
    const reply = await this.replyRepository.findOne({
      where: { id: reply_id },
      relations: ['user', 'board', 'comment_reply'],
    });
    const user = await this.userService.findById(user_id);
    const commentReply = new CommentReply();
    if (
      detail.includes('씨발') ||
      detail.includes('개새끼') ||
      detail.includes('병신')
    ) {
      throw new HttpException(
        '댓글 내용에 욕이 포함되어 있어 작성할 수 없습니다.',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.pointService.increase(user.id, 1);
    commentReply.user = user;
    commentReply.reply = reply;
    commentReply.detail = detail;
    reply.comment_reply.push(commentReply);
    //const result = await this.replyRepository.save(commentReply);
    await this.commentReplyRepository.save(commentReply);
    await this.replyRepository.save(reply);
    //await this.notificationService.create(commentReply.id, '300');
    return await this.findById(reply.board.id);
  }

  async deleteCommentReply(
    user_id: string,
    commentReply_id: string,
  ): Promise<Board> {
    const checkcomment_reply = await this.commentReplyRepository.findOne({
      where: { id: commentReply_id },
      relations: ['user', 'board', 'reply'],
    });
    const reply = checkcomment_reply.reply;
    if (checkcomment_reply.user.id !== user_id) {
      throw new ForbiddenException(`본인이 작성한 댓글만 삭제할 수 있습니다.`);
    }
    if (!checkcomment_reply) {
      throw new NotFoundException('댓글이 존재하지 않습니다.');
    }
    const replyIndex = reply.comment_reply.findIndex(
      (reply) => reply.id === checkcomment_reply.id,
    );
    await this.pointService.increase(user_id, -1);
    reply.comment_reply.splice(replyIndex, 1);
    await this.commentReplyRepository.delete(checkcomment_reply.id);
    await this.boardRepository.save(reply);
    return await this.findById(reply.board.id);
  }
}
