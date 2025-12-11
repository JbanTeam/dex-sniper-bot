import { Logger, ExceptionFilter, Catch, HttpException } from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown) {
    let message: string | object;
    let error: string;
    let stack: string | undefined;

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as Record<string, unknown>)['message'] ?? exceptionResponse;
        error = (exceptionResponse as Record<string, unknown>)['error']?.toString() ?? exception.constructor.name;
      } else {
        message = exceptionResponse;
        error = exception.constructor.name;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.constructor.name;
      stack = exception.stack;
    } else {
      message = 'Internal server error';
      error = 'InternalServerError';
    }

    this.logger.error(
      `Exception: ${error}, Message: ${typeof message === 'object' ? JSON.stringify(message) : message}, Stack: ${stack}`,
      stack,
    );
  }
}
