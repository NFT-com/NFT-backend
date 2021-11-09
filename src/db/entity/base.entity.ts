import { nanoid } from 'nanoid'
import {
  BeforeInsert,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity()
export class BaseEntity {

  @PrimaryColumn()
  id: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @DeleteDateColumn()
  deletedAt?: Date

  @BeforeInsert()
  addId(): void {
    this.id = this.id ? this.id : nanoid()
  }

}
