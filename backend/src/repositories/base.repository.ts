import prisma from '../config/database.js';

export abstract class BaseRepository {
  protected readonly db = prisma;
}

export default BaseRepository;
