import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join, resolve } from 'path';

@Injectable()
export class StorageService {
  private readonly root = resolve(
    process.env.STORAGE_PATH ?? join(process.cwd(), 'storage'),
  );

  private safe(relativePath: string) {
    const absolute = resolve(this.root, relativePath);
    if (!absolute.startsWith(`${this.root}/`))
      throw new BadRequestException('Invalid storage path');
    return absolute;
  }

  async write(
    kind: 'signatures' | 'delivery-notes',
    extension: 'png' | 'pdf',
    content: Buffer,
  ) {
    const relative = join(kind, `${randomUUID()}.${extension}`);
    const absolute = this.safe(relative);
    await mkdir(resolve(absolute, '..'), { recursive: true });
    await writeFile(absolute, content, { flag: 'wx' });
    return relative;
  }

  async read(relativePath: string) {
    return readFile(this.safe(relativePath));
  }
}
