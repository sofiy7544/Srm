import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { TasksService } from './tasks.service';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import {
  createTaskSchema,
  updateTaskSchema,
  taskFilterSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
  type TaskFilter,
} from '@crm/shared';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Query(new ZodValidationPipe(taskFilterSchema)) filter: TaskFilter,
  ) {
    return this.tasks.list(user, filter);
  }

  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(createTaskSchema)) body: CreateTaskInput,
  ) {
    return this.tasks.create(user, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateTaskSchema)) body: UpdateTaskInput,
  ) {
    return this.tasks.update(user, id, body);
  }

  @Post(':id/complete')
  complete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasks.complete(user, id);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasks.remove(user, id);
  }
}
