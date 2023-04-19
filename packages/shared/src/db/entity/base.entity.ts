import { nanoid } from 'nanoid'
import {
  BeforeInsert,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity()
export class BaseEntity {
  @PrimaryColumn()
  id: string

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date

  @Index() // Add index on deletedAt column
  @DeleteDateColumn({ type: 'timestamp with time zone' })
  deletedAt?: Date

  @BeforeInsert()
  addId(): void {
    this.id = this.id ? this.id : nanoid()
  }
}
