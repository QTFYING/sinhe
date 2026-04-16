import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';
import { ID_CONFIG } from './id-generator.constants';

const VALID_SEQ_NAMES = new Set(
  Object.values(ID_CONFIG)
    .filter((c): c is (typeof c) & { seqName: string } => 'seqName' in c)
    .map((c) => c.seqName),
);

@Injectable()
export class IdGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 按天重置的业务编号。
   * 每天序号从 1 开始，格式：{prefix}{YYYYMMDD}{padded seq}
   */
  async nextDailyId(prefix: string, digits: number): Promise<string> {
    const rows = await this.prisma.$queryRaw<
      { current_val: bigint; date_key: Date }[]
    >`
      INSERT INTO id_sequences (prefix, date_key, current_val)
      VALUES (${prefix}, CURRENT_DATE, 1)
      ON CONFLICT (prefix, date_key)
      DO UPDATE SET current_val = id_sequences.current_val + 1
      RETURNING current_val, date_key
    `;

    const { current_val, date_key } = rows[0];
    const dateStr = dayjs(date_key).format('YYYYMMDD');
    const seq = String(current_val).padStart(digits, '0');
    return `${prefix}${dateStr}${seq}`;
  }

  /**
   * 全局递增的业务编号（不含日期段）。
   * 格式：{prefix}{padded seq}
   */
  async nextGlobalId(prefix: string, seqName: string, digits: number): Promise<string> {
    if (!VALID_SEQ_NAMES.has(seqName)) {
      throw new Error(`Invalid sequence name: ${seqName}`);
    }

    const rows = await this.prisma.$queryRawUnsafe<{ nextval: bigint }[]>(
      `SELECT nextval('${seqName}')`,
    );

    const seq = String(rows[0].nextval).padStart(digits, '0');
    return `${prefix}${seq}`;
  }
}
